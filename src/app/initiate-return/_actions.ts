"use server";

import type { Order } from "@/lib/schemas";
import { getOrderById } from "@/server/data/orders";

// Server action wrapper so the client page can fetch an order without
// pulling Prisma into the browser bundle. The returns flow is intentionally
// "anyone who knows the order number can view it" (same model as the rest
// of the find-order/track-order surface) — no extra auth here.
export async function findOrderForReturn(orderIdOrNumber: string): Promise<Order | null> {
  return getOrderById(orderIdOrNumber);
}
