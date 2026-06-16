import { prisma } from '@/server/db/client';
import { adoptGuestCart, deleteCart, findCartBySessionToken, findCartByUserId } from '@/server/repositories/cart.repo';

export interface MergeArgs {
  userId: string;
  guestSessionToken: string;
}

export async function mergeGuestIntoUser({ userId, guestSessionToken }: MergeArgs) {
  return prisma.$transaction(async (tx) => {
    const guest = await findCartBySessionToken(guestSessionToken, tx);
    const userCart = await findCartByUserId(userId, tx);

    if (!guest) {
      // No guest cart to merge. Return existing user cart, or create empty one.
      if (userCart) return userCart;
      return tx.cart.create({
        data: { userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        include: { items: true },
      });
    }

    if (!userCart) {
      // Adopt guest as user cart.
      return adoptGuestCart(guest.id, userId, tx);
    }

    // Merge items: for each guest item, find matching (productId,size,colour) in userCart.
    for (const gItem of guest.items) {
      const matching = userCart.items.find(
        (u) =>
          u.productId === gItem.productId &&
          u.size === gItem.size &&
          u.colour === gItem.colour,
      );
      const stockRow = await tx.productSize.findUnique({
        where: {
          productId_size_colour: {
            productId: gItem.productId,
            size: gItem.size,
            colour: gItem.colour,
          },
        },
      });
      const stock = stockRow?.stock ?? 0;

      if (matching) {
        const merged = Math.min(matching.quantity + gItem.quantity, stock);
        await tx.cartItem.update({ where: { id: matching.id }, data: { quantity: merged } });
      } else {
        const qty = Math.min(gItem.quantity, stock);
        if (qty > 0) {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: gItem.productId,
              size: gItem.size,
              colour: gItem.colour,
              quantity: qty,
              unitPriceCents: gItem.unitPriceCents,
              currency: gItem.currency,
              isPreorder: gItem.isPreorder,
            },
          });
        }
      }
    }

    // Promo precedence: keep userCart.promoCodeId if set; else inherit guest's.
    if (!userCart.promoCodeId && guest.promoCodeId) {
      await tx.cart.update({ where: { id: userCart.id }, data: { promoCodeId: guest.promoCodeId } });
    }

    await deleteCart(guest.id, tx);
    return tx.cart.findUniqueOrThrow({ where: { id: userCart.id }, include: { items: true } });
  });
}
