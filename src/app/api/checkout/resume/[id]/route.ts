import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { stripe } from '@/server/checkout/stripe';
import { getSessionUser } from '@/server/auth/session';
import { verifyOrderToken } from '@/server/checkout/order-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDER_TOKEN_COOKIE = '__ynot_order_token';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Resume payment for an order whose first attempt didn't complete.
 *
 * Looks up the order by `id` or `orderNumber` (so the URL works with both),
 * authorises the caller (signed-in owner OR ghost-order cookie), confirms the
 * order is still in a payable state, and returns the Stripe PaymentIntent
 * `client_secret` so the storefront can re-mount `<PaymentElement>` against
 * the same intent rather than starting over from /cart.
 */
export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  const order =
    (await prisma.order.findUnique({ where: { id } })) ??
    (await prisma.order.findUnique({ where: { orderNumber: id } }));
  if (!order) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  // Auth: signed-in owner OR order-token cookie that matches.
  const user = await getSessionUser();
  let authorised = Boolean(user && order.userId === user.id);
  if (!authorised) {
    const cookieJar = await cookies();
    const tokenValue = cookieJar.get(ORDER_TOKEN_COOKIE)?.value ?? '';
    const verified = verifyOrderToken(tokenValue);
    authorised = Boolean(
      verified &&
        verified.orderId === order.id &&
        verified.createdAt === order.createdAt.toISOString(),
    );
  }
  if (!authorised) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  if (order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_FAILED') {
    return NextResponse.json(
      { error: 'NOT_PAYABLE', status: order.status },
      { status: 409 },
    );
  }

  const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
  if (!payment?.stripePaymentIntentId) {
    return NextResponse.json({ error: 'NO_PAYMENT_INTENT' }, { status: 409 });
  }

  const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
  if (!intent.client_secret) {
    return NextResponse.json({ error: 'NO_CLIENT_SECRET' }, { status: 500 });
  }

  return NextResponse.json({
    orderId: order.id,
    clientSecret: intent.client_secret,
    totalCents: order.totalCents,
    currency: order.currency,
  });
}
