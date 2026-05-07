import { cookies } from "next/headers";
import type {
  Order,
  OrderItem,
  OrderStatusEvent,
  Prisma,
  Return,
  ReturnItem,
  Shipment,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { getSessionUser } from "@/server/auth/session";
import { verifyOrderToken } from "@/server/checkout/order-token";

const ORDER_TOKEN_COOKIE = "__ynot_order_token";

const include = {
  items: { orderBy: { id: "asc" } },
  shipments: { orderBy: { createdAt: "asc" } },
  events: { orderBy: { createdAt: "asc" } },
  returns: {
    orderBy: { createdAt: "desc" },
    include: { items: { include: { orderItem: true } } },
  },
} satisfies Prisma.OrderInclude;

export type CustomerOrderDetail = Order & {
  items: OrderItem[];
  shipments: Shipment[];
  events: OrderStatusEvent[];
  returns: Array<Return & { items: Array<ReturnItem & { orderItem: OrderItem }> }>;
};

/**
 * Customer-facing order detail loader for `/account/orders/[id]`.
 *
 * Resolves by `Order.id` first, falling back to `Order.orderNumber` so the
 * route works whether the URL holds the cuid or the human-friendly number.
 *
 * Authorisation mirrors `GET /api/orders/[id]` (Phase 4): the signed-in
 * session may view its own orders, OR an anonymous request may view an order
 * if the `__ynot_order_token` HMAC cookie matches the order id + createdAt.
 *
 * Returns null when the order does not exist OR when the caller is not
 * authorised; the page should `notFound()` in either case.
 */
export async function getCustomerOrderById(
  idOrOrderNumber: string,
): Promise<CustomerOrderDetail | null> {
  const order =
    (await prisma.order.findUnique({ where: { id: idOrOrderNumber }, include })) ??
    (await prisma.order.findUnique({
      where: { orderNumber: idOrOrderNumber },
      include,
    }));
  if (!order) return null;

  const user = await getSessionUser();
  if (user && order.userId === user.id) return order;

  const cookieJar = await cookies();
  const tokenValue = cookieJar.get(ORDER_TOKEN_COOKIE)?.value ?? "";
  const verified = verifyOrderToken(tokenValue);
  if (
    verified &&
    verified.orderId === order.id &&
    verified.createdAt === order.createdAt.toISOString()
  ) {
    return order;
  }

  return null;
}
