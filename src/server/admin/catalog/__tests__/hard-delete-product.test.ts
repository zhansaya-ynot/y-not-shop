import { describe, expect, it } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { hardDeleteProduct } from '../product-service';

describe('hardDeleteProduct', () => {
  it('removes the product + cascaded rows, clears carts, and preserves order history', async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });

    const product = await prisma.product.create({
      data: {
        name: 'Doomed', slug: 'doomed', description: 'd', priceCents: 1000,
        materials: '', care: '', sizing: '', status: 'ARCHIVED',
        sizes: { create: [{ size: 'M', stock: 5 }] },
        colours: { create: [{ name: 'Black', hex: '#000000' }] },
        images: { create: [{ url: 'https://x/a.jpg' }] },
      },
    });

    // A live cart line — this is the only relation that would block a delete.
    const cart = await prisma.cart.create({
      data: { sessionToken: 's1', expiresAt: new Date('2030-01-01') },
    });
    await prisma.cartItem.create({
      data: {
        cartId: cart.id, productId: product.id, size: 'M', colour: 'Black',
        quantity: 1, unitPriceCents: 1000,
      },
    });

    // A past order referencing the product — must survive the delete.
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-TEST-1', subtotalCents: 1000, shippingCents: 0, totalCents: 1000,
        carrier: 'DHL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1 St',
        shipCity: 'London', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: {
          create: {
            productId: product.id, productSlug: 'doomed', productName: 'Doomed',
            productImage: 'https://x/a.jpg', colour: 'Black', size: 'M',
            unitPriceCents: 1000, quantity: 1,
          },
        },
      },
      include: { items: true },
    });

    await hardDeleteProduct({ id: product.id, actorId: 'u1' });

    // Product and its cascaded children are gone.
    expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
    expect(await prisma.productSize.count({ where: { productId: product.id } })).toBe(0);
    expect(await prisma.colourOption.count({ where: { productId: product.id } })).toBe(0);
    expect(await prisma.productImage.count({ where: { productId: product.id } })).toBe(0);
    // Cart line cleared (would otherwise RESTRICT the delete).
    expect(await prisma.cartItem.count({ where: { productId: product.id } })).toBe(0);

    // Order history intact: row survives, productId nulled, snapshot preserved.
    const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: order.items[0].id } });
    expect(item.productId).toBeNull();
    expect(item.productName).toBe('Doomed');
    expect(item.size).toBe('M');
    expect(item.colour).toBe('Black');
  });
});
