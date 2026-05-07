import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import {
  findCartByUserId,
  findCartBySessionToken,
  createGuestCart,
  createUserCart,
  type CartClient,
} from '@/server/repositories/cart.repo';
import { assignItemToBatchOrCreate } from '@/server/preorders/service';
import type { CartSnapshotT, CartItemSnapshotT, AddItemRequestT } from '@/lib/schemas/cart';

export interface CartIdentity {
  userId: string | null;
  sessionToken: string | null;
}

export async function getOrCreateCart(
  identity: CartIdentity,
  client: CartClient = prisma,
) {
  if (identity.userId) {
    const existing = await findCartByUserId(identity.userId, client);
    if (existing) return existing;
    return createUserCart(identity.userId, client);
  }
  if (identity.sessionToken) {
    const existing = await findCartBySessionToken(identity.sessionToken, client);
    if (existing) return existing;
  }
  // Caller must provide a token when guest; we don't generate here.
  if (!identity.sessionToken) {
    throw new Error('getOrCreateCart: guest carts require a sessionToken');
  }
  return createGuestCart(identity.sessionToken, client);
}

/**
 * Compute a `CartSnapshot` for the given cart id.
 * Joins Cart → CartItem → Product (slug,name,priceCents) → Product.images[0]
 * → ProductSize.stock per (productId,size) → optional PromoCode.
 */
export async function snapshotCart(
  cartId: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  const cart = await client.cart.findUniqueOrThrow({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, sizes: true },
          },
        },
      },
      promoCode: true,
    },
  });
  const items: CartItemSnapshotT[] = cart.items.map((it) => {
    const stockRow = it.product.sizes.find((s) => s.size === it.size);
    return {
      id: it.id,
      productId: it.productId,
      productSlug: it.product.slug,
      productName: it.product.name,
      productImage: it.product.images[0]?.url ?? '',
      colour: it.colour,
      size: it.size as CartItemSnapshotT['size'],
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      currency: 'GBP' as const,
      isPreorder: it.isPreorder,
      preorderBatchId: it.preorderBatchId,
      stockAvailable: stockRow?.stock ?? 0,
    };
  });
  const subtotalCents = items.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0);
  let discountCents = 0;
  let promo: CartSnapshotT['promo'] = null;
  if (cart.promoCode) {
    const p = cart.promoCode;
    discountCents =
      p.discountType === 'PERCENT'
        ? Math.round((subtotalCents * p.discountValue) / 100)
        : p.discountValue;
    discountCents = Math.min(discountCents, subtotalCents);
    promo = { code: p.code, discountCents };
  }
  return {
    id: cart.id,
    items,
    subtotalCents,
    discountCents,
    promo,
    itemCount,
    expiresAt: cart.expiresAt.toISOString(),
  };
}

// ---- addItem ----

export class StockConflictError extends Error {
  constructor(
    public readonly productId: string,
    public readonly size: string,
    public readonly stockAvailable: number,
  ) {
    super(`Insufficient stock for product ${productId} size ${size}: ${stockAvailable} available`);
    this.name = 'StockConflictError';
  }
}

export async function addItem(
  cartId: string,
  input: AddItemRequestT,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      include: { sizes: { where: { size: input.size } } },
    });
    const stockRow = product.sizes[0];
    if (!stockRow) throw new Error(`Product ${input.productId} has no size ${input.size}`);

    const existingItem = await tx.cartItem.findFirst({
      where: { cartId, productId: input.productId, size: input.size },
    });
    const totalQty = (existingItem?.quantity ?? 0) + input.quantity;

    // Auto-assign preorder items to the active PreorderBatch (spec §9.2 / Group M).
    // `Product.preOrder = true` is the catalog-side flag; the per-line
    // `input.isPreorder` mirrors it from the PDP.  Either signal triggers the
    // lookup so an item never lands in cart with `isPreorder = true` but no
    // batch — the checkout shipment splitter would otherwise drop it.
    const treatAsPreorder = product.preOrder || input.isPreorder;

    // Stock guard only applies to in-stock items; preorders ship from a
    // future batch so current stock can legitimately be 0. Without this
    // skip, every preorder add bounced as STOCK_CONFLICT and the customer
    // saw nothing happen on click.
    if (!treatAsPreorder && totalQty > stockRow.stock) {
      throw new StockConflictError(input.productId, input.size, stockRow.stock);
    }

    let preorderBatchId: string | null = null;
    if (treatAsPreorder) {
      preorderBatchId = await assignItemToBatchOrCreate(input.productId, tx);
    }

    if (existingItem) {
      await tx.cartItem.update({ where: { id: existingItem.id }, data: { quantity: totalQty } });
    } else {
      await tx.cartItem.create({
        data: {
          cartId,
          productId: input.productId,
          size: input.size,
          colour: input.colour,
          quantity: input.quantity,
          unitPriceCents: product.priceCents,
          currency: 'GBP',
          isPreorder: treatAsPreorder,
          preorderBatchId,
        },
      });
    }
    await tx.cartEvent.create({ data: { cartId, kind: 'ITEM_ADDED', metadata: { ...input } } });
    return snapshotCart(cartId, tx);
  }
}

// ---- setQuantity + removeItem ----

export async function setQuantity(
  cartId: string,
  itemId: string,
  quantity: number,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    if (quantity <= 0) {
      await tx.cartItem.delete({ where: { id: itemId } });
      await tx.cartEvent.create({ data: { cartId, kind: 'ITEM_REMOVED', metadata: { itemId } } });
      return snapshotCart(cartId, tx);
    }
    const item = await tx.cartItem.findUniqueOrThrow({ where: { id: itemId } });
    const stockRow = await tx.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: item.productId, size: item.size } },
    });
    if (quantity > stockRow.stock) {
      throw new StockConflictError(item.productId, item.size, stockRow.stock);
    }
    await tx.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return snapshotCart(cartId, tx);
  }
}

export async function removeItem(
  cartId: string,
  itemId: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    await tx.cartItem.delete({ where: { id: itemId } });
    await tx.cartEvent.create({ data: { cartId, kind: 'ITEM_REMOVED', metadata: { itemId } } });
    return snapshotCart(cartId, tx);
  }
}

// ---- applyPromo + removePromo ----

export type PromoErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'INACTIVE' | 'LIMIT_REACHED' | 'MIN_ORDER';

export class PromoApplyError extends Error {
  constructor(public readonly code: PromoErrorCode, message: string) {
    super(message);
    this.name = 'PromoApplyError';
  }
}

export async function applyPromo(
  cartId: string,
  rawCode: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  return (client === prisma ? prisma.$transaction(run) : run(client as Prisma.TransactionClient));

  async function run(tx: Prisma.TransactionClient) {
    const code = rawCode.trim().toUpperCase();
    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo || promo.deletedAt) throw new PromoApplyError('NOT_FOUND', `Promo ${code} not found`);
    if (!promo.isActive) throw new PromoApplyError('INACTIVE', `Promo ${code} not active`);
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new PromoApplyError('EXPIRED', `Promo ${code} expired`);
    }
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new PromoApplyError('LIMIT_REACHED', `Promo ${code} usage limit reached`);
    }
    // Compute current cart subtotal (from items only, before discount).
    const items = await tx.cartItem.findMany({ where: { cartId } });
    const subtotal = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
    if (subtotal < promo.minOrderCents) {
      throw new PromoApplyError('MIN_ORDER', `Subtotal £${(subtotal / 100).toFixed(2)} below £${(promo.minOrderCents / 100).toFixed(2)}`);
    }
    await tx.cart.update({ where: { id: cartId }, data: { promoCodeId: promo.id } });
    return snapshotCart(cartId, tx);
  }
}

export async function removePromo(
  cartId: string,
  client: CartClient = prisma,
): Promise<CartSnapshotT> {
  await (client as typeof prisma).cart.update({ where: { id: cartId }, data: { promoCodeId: null } });
  return snapshotCart(cartId, client);
}
