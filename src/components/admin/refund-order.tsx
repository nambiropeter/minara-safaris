import type { Payload } from "payload";

import { formatMoney, type Currency } from "@/lib/money";
import { RefundButton } from "./refund-button";

type Props = { id?: number | string; payload: Payload };

/**
 * Server component rendered by Payload for the Orders `refund` ui field. Shows the
 * button only where a refund is possible: a paid or confirmed order with a recorded
 * Stripe payment. Everything else (pending, failed, already refunded) renders nothing.
 */
export async function RefundOrder({ id, payload }: Props) {
  if (!id) return null;

  const order = await payload.findByID({
    collection: "orders",
    id,
    depth: 0,
    disableErrors: true,
  });
  const refundable =
    order &&
    (order.status === "paid" || order.status === "confirmed") &&
    Boolean(order.stripe?.paymentIntentId);
  if (!order || !refundable) return null;

  return (
    <RefundButton id={order.id} amount={formatMoney(order.amountTotal, order.currency as Currency)} />
  );
}
