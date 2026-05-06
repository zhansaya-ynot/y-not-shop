import { z } from "zod";
import { CartItemSchema } from "./cart";
import { AddressSchema } from "./address";

export const OrderStatusSchema = z.enum([
  "pending_payment",
  "payment_failed",
  "new",
  "processing",
  "partially_shipped",
  "shipped",
  "partially_delivered",
  "delivered",
  "returned",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const CarrierSchema = z.enum(["royal-mail", "dhl"]);
export type Carrier = z.infer<typeof CarrierSchema>;

export const OrderSchema = z.object({
  id: z.string().min(1),
  /**
   * Internal prisma `Order.id` (cuid). Distinct from `id` (orderNumber) so the
   * returns wizard can post `orderId` to `/api/returns` while existing UI
   * continues to display the human-friendly number.
   */
  recordId: z.string().optional(),
  /** ISO 8601 timestamp */
  createdAt: z.string(),
  status: OrderStatusSchema,
  items: z.array(CartItemSchema),
  subtotal: z.number().int().nonnegative(),
  shipping: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  currency: z.literal("GBP"),
  carrier: CarrierSchema,
  trackingNumber: z.string().nullable(),
  shippingAddress: AddressSchema,
  /** YYYY-MM-DD */
  estimatedDeliveryDate: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;
