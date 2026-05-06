import type { Size } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { stripe } from './stripe';
import { snapshotCart, StockConflictError } from '@/server/cart/service';
import { getOrCreateGuestUser } from '@/server/repositories/user.repo';
import { getShippingProvider } from '@/server/shipping/zones';
import { nextOrderNumber } from './order-number';
import { signOrderToken } from './order-token';
import { splitOrderIntoShipments } from '@/server/orders/shipments';
import type { ShippingAddressT } from '@/lib/schemas/checkout';
import type { AttributionPayload } from '@/server/attribution/cookie';

export interface CreateOrderArgs {
  cartId: string;
  user: { id: string } | null;
  address: ShippingAddressT;
  methodId: string;
  attribution: AttributionPayload | null;
}

export interface CreateOrderResult {
  orderId: string;
  clientSecret: string;
  orderToken: string; // signed cookie value for guest viewing of /checkout/success
}

export async function createOrderAndPaymentIntent(
  args: CreateOrderArgs,
): Promise<CreateOrderResult> {
  // Phase 1: DB transaction — stock lock, validation, Order/Payment insert.
  const order = await prisma.$transaction(async (tx) => {
    // 1. Snapshot the cart inside tx for fresh prices/stock.
    const snap = await snapshotCart(args.cartId, tx);
    if (snap.items.length === 0) throw new Error('Cart is empty');

    // 2. Lock stock rows and re-validate.
    if (snap.items.length > 0) {
      // SELECT ... FOR UPDATE on (product_id, size) tuples.
      // Prisma does not yet have a native FOR UPDATE; raw SQL on the same tx is safe.
      const keys = snap.items.map((i) => `('${i.productId}','${i.size}')`).join(',');
      await tx.$queryRawUnsafe(
        `SELECT "productId", "size", "stock" FROM "ProductSize" WHERE ("productId", "size") IN (${keys}) FOR UPDATE`,
      );
    }
    for (const item of snap.items) {
      // Preorders ship from a future batch — current stock is allowed to be
      // 0, so the guard would always trip. Skip the check; the batch capacity
      // is enforced separately when assignItemToBatch runs at cart time.
      if (item.isPreorder) continue;
      const stockRow = await tx.productSize.findUniqueOrThrow({
        where: { productId_size: { productId: item.productId, size: item.size } },
      });
      if (stockRow.stock < item.quantity) {
        throw new StockConflictError(item.productId, item.size, stockRow.stock);
      }
    }

    // 3. Atomic stock decrement (in-stock items only — preorders aren't
    //    drawn from current stock, they're produced for the next batch).
    for (const item of snap.items) {
      if (item.isPreorder) continue;
      await tx.productSize.update({
        where: { productId_size: { productId: item.productId, size: item.size } },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 4. Quote shipping (re-fetch — do not trust client).
    const provider = getShippingProvider();
    const subtotalAfterDiscount = snap.subtotalCents - snap.discountCents;
    const products = await tx.product.findMany({
      where: { id: { in: snap.items.map((i) => i.productId) } },
    });
    const quotes = await provider.quote({
      origin: { country: 'GB' },
      destination: { countryCode: args.address.countryCode, postcode: args.address.postcode },
      items: snap.items.map((i) => {
        const p = products.find((x) => x.id === i.productId);
        return {
          productId: i.productId,
          quantity: i.quantity,
          weightGrams: p?.weightGrams ?? 1500,
          unitPriceCents: i.unitPriceCents,
          hsCode: p?.hsCode ?? undefined,
          countryOfOriginCode: p?.countryOfOriginCode ?? undefined,
        };
      }),
      subtotalCents: subtotalAfterDiscount,
    });
    const method = quotes.find((q) => q.methodId === args.methodId);
    if (!method) throw new Error(`Invalid shipping method: ${args.methodId}`);

    // 5. Re-validate promo (race window).
    const cartRow = await tx.cart.findUniqueOrThrow({
      where: { id: args.cartId }, include: { promoCode: true },
    });
    if (cartRow.promoCode) {
      const p = cartRow.promoCode;
      if (!p.isActive || (p.expiresAt && p.expiresAt < new Date()) ||
          (p.usageLimit !== null && p.usageCount >= p.usageLimit)) {
        throw new Error(`Promo ${p.code} is no longer valid`);
      }
    }

    // 6. Resolve / create ghost user if guest.
    let userId = args.user?.id;
    if (!userId) {
      const ghost = await getOrCreateGuestUser({ email: args.address.email }, tx);
      userId = ghost.id;
    }

    // 7. Compute totals.
    const totalCents = snap.subtotalCents + method.totalCents - snap.discountCents;

    // 8. Create Order + OrderItems + Payment.
    const created = await tx.order.create({
      data: {
        orderNumber: await nextOrderNumber(tx),
        userId,
        status: 'PENDING_PAYMENT',
        subtotalCents: snap.subtotalCents,
        shippingCents: method.totalCents,
        discountCents: snap.discountCents,
        totalCents,
        currency: 'GBP',
        carrier: method.carrier,
        shipFirstName: args.address.firstName,
        shipLastName: args.address.lastName,
        shipLine1: args.address.line1,
        shipLine2: args.address.line2 ?? null,
        shipCity: args.address.city,
        shipPostcode: args.address.postcode,
        shipCountry: args.address.countryCode,
        shipPhone: args.address.phone,
        utmSource: args.attribution?.utmSource ?? null,
        utmMedium: args.attribution?.utmMedium ?? null,
        utmCampaign: args.attribution?.utmCampaign ?? null,
        utmTerm: args.attribution?.utmTerm ?? null,
        utmContent: args.attribution?.utmContent ?? null,
        referrer: args.attribution?.referrer ?? null,
        landingPath: args.attribution?.landingPath ?? null,
        promoCodeId: cartRow.promoCodeId ?? null,
        items: {
          create: snap.items.map((i) => ({
            product: { connect: { id: i.productId } },
            productSlug: i.productSlug,
            productName: i.productName,
            productImage: i.productImage,
            colour: i.colour,
            size: i.size as Size,
            unitPriceCents: i.unitPriceCents,
            currency: 'GBP',
            quantity: i.quantity,
            isPreorder: i.isPreorder,
            // Carry the cart-side batch assignment forward so
            // `splitOrderIntoShipments` can group preorders by batch.
            ...(i.preorderBatchId
              ? { preorderBatch: { connect: { id: i.preorderBatchId } } }
              : {}),
          })),
        },
        payment: {
          create: {
            status: 'PENDING',
            amountCents: totalCents,
            currency: 'GBP',
          },
        },
        events: {
          create: { status: 'PENDING_PAYMENT', note: 'Order created' },
        },
      },
      include: { payment: true, items: true },
    });

    // 9. Split items into Shipments. One in-stock group + one per preorder
    // batch. `splitOrderIntoShipments` is pure; we persist the result here so
    // every Order leaves checkout with at least one Shipment row.
    const groups = splitOrderIntoShipments(created.items, created.shipCountry);
    for (const group of groups) {
      const shipment = await tx.shipment.create({
        data: {
          orderId: created.id,
          carrier: group.carrier,
        },
      });
      await tx.orderItem.updateMany({
        where: { id: { in: group.itemIds } },
        data: { shipmentId: shipment.id },
      });
    }

    return created;
  });

  // Phase 2: Stripe call outside the DB tx. If this throws, the order stays
  // in PENDING_PAYMENT — recovery cron in Phase 5 will release stock.
  const intent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'gbp',
    automatic_payment_methods: { enabled: true },
    metadata: { orderId: order.id },
    receipt_email: args.address.email,
  });

  await prisma.payment.update({
    where: { orderId: order.id },
    data: { stripePaymentIntentId: intent.id },
  });

  const orderToken = signOrderToken(order.id, order.createdAt);

  return {
    orderId: order.id,
    clientSecret: intent.client_secret!,
    orderToken,
  };
}
