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
    (await prisma.order.findUnique({
      where: { id },
      include: { items: { orderBy: { id: 'asc' } } },
    })) ??
    (await prisma.order.findUnique({
      where: { orderNumber: id },
      include: { items: { orderBy: { id: 'asc' } } },
    }));
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

  // Try to reuse the original PaymentIntent. If it doesn't exist (e.g. the
  // order pre-dates a Stripe key rotation, so the stored PI lives in a
  // different account) or has reached a terminal state, fall through to
  // creating a fresh intent for the same order amount.
  let clientSecret: string | null = null;
  if (payment?.stripePaymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      const reusable = intent.status === 'requires_payment_method'
        || intent.status === 'requires_confirmation'
        || intent.status === 'requires_action';
      if (reusable && intent.client_secret) {
        clientSecret = intent.client_secret;
      }
    } catch {
      // Stripe couldn't find the intent under this account/key — make a new one.
    }
  }

  if (!clientSecret) {
    const fresh = await stripe.paymentIntents.create({
      amount: order.totalCents,
      currency: order.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: order.id, orderNumber: order.orderNumber, resumed: 'true' },
    });
    if (!fresh.client_secret) {
      return NextResponse.json({ error: 'NO_CLIENT_SECRET' }, { status: 500 });
    }
    clientSecret = fresh.client_secret;

    // Persist so subsequent webhooks can be matched against this order.
    if (payment) {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: { stripePaymentIntentId: fresh.id, status: 'PENDING' },
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          stripePaymentIntentId: fresh.id,
          status: 'PENDING',
          amountCents: order.totalCents,
          currency: order.currency,
        },
      });
    }
  }

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    clientSecret,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    currency: order.currency,
    items: order.items.map((it) => ({
      id: it.id,
      name: it.productName,
      image: it.productImage,
      colour: it.colour,
      size: it.size,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
    })),
  });
}
