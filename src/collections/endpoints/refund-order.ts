import type { PayloadHandler } from "payload";

import { cancelBooking, getHotelbeds } from "../../lib/hotelbeds.ts";
import { formatMoney, type Currency } from "../../lib/money.ts";
import { refundPayment } from "../../lib/refund.ts";
import { getStripe } from "../../lib/stripe.ts";

/**
 * Staff-only (Payload session auth). Imported by a collection config, so: relative
 * `.ts` imports, and the Local API comes from `req.payload` (never `getPayload`).
 */

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Refunds a paid order in full.
 *
 * This only *asks Stripe*. It deliberately does not mark the order refunded:
 * the signature-verified `charge.refunded` webhook is the single writer of that
 * status, the same way it is for `paid`. That also means a refund made in the
 * Stripe dashboard and one made here land identically.
 *
 * The idempotency key makes a double click (or a retry) a no-op instead of a
 * second refund attempt.
 */
export const refundOrder: PayloadHandler = async (req) => {
  if (!req.user) return json({ error: "Unauthorized." }, 401);

  const order = await req.payload.findByID({
    collection: "orders",
    id: String(req.routeParams?.id),
    depth: 0,
    disableErrors: true,
  });
  if (!order) return json({ error: "Order not found." }, 404);

  if (order.status === "refunded") {
    return json({ error: "This order has already been refunded." }, 409);
  }
  if (order.status !== "paid" && order.status !== "confirmed") {
    return json({ error: "Only a paid order can be refunded." }, 409);
  }

  const paymentIntent = order.stripe?.paymentIntentId;
  if (!paymentIntent) {
    return json({ error: "No Stripe payment is recorded for this order." }, 409);
  }

  const stripe = getStripe();
  if (!stripe) return json({ error: "Stripe is not configured." }, 503);

  // A hotel is a live booking with Hotelbeds. Refunding the customer while it stands would
  // leave Minara owing the hotel, so the booking goes first.
  const supplier = order.supplier;
  if (supplier?.name === "hotelbeds") {
    const status = supplier.status;
    if (status === "booked") {
      // Fees depend on timing, and splitting a refund by them is a decision for a person.
      // Inside the free window the customer's refund is simply the whole payment.
      const first = supplier.cancellationPolicies?.[0];
      const free = Boolean(first && Date.parse(first.from) > Date.now());
      if (!free) {
        return json(
          { error: "This hotel booking has cancellation fees. Cancel it with Hotelbeds and refund the right amount by hand in Stripe." },
          409,
        );
      }
      const config = getHotelbeds();
      if (!config || !supplier.reference) return json({ error: "Hotelbeds is not configured, so the hotel booking can't be cancelled." }, 503);

      const cancelled = await cancelBooking(config, supplier.reference);
      if (cancelled.outcome !== "cancelled") {
        return json({ error: `The hotel booking could not be cancelled, so nothing was refunded. ${cancelled.reason}` }, 502);
      }
      // Recorded before the refund, so a refund that then fails can be retried without cancelling twice.
      await req.payload.update({
        collection: "orders",
        id: order.id,
        data: {
          supplier: {
            status: "cancelled",
            note: `Cancelled with Hotelbeds by ${req.user.email}${cancelled.feeNet > 0 ? `; Hotelbeds charged EUR ${cancelled.feeNet}` : ""}.`,
          },
        },
      });
    } else if (status !== "cancelled" && status !== "failed") {
      // 'failed' and 'cancelled' have nothing live to cancel (a retry after a refund hiccup lands here).
      return json(
        { error: `The hotel booking status is "${status ?? "unknown"}". Check Hotelbeds for ${order.orderNumber} before refunding.` },
        409,
      );
    }
  }

  const refund = await refundPayment(stripe, {
    paymentIntentId: paymentIntent,
    orderId: order.id,
    idempotencyKey: `refund-order-${order.id}`,
    requestedBy: req.user.email,
  });
  if (!refund.ok) {
    return refund.reason === "already_refunded"
      ? json({ error: "Stripe says this payment is already refunded." }, 409)
      : json({ error: refund.message }, 502);
  }

  // Audit trail: who asked. The money has moved by now, so a failure to write
  // the note must not turn this into an error.
  try {
    const amount = formatMoney(order.amountTotal, order.currency as Currency);
    await req.payload.update({
      collection: "orders",
      id: order.id,
      data: {
        staffNotes: `${order.staffNotes ?? ""}\nRefund of ${amount} requested by ${req.user.email}.`.trim(),
      },
    });
  } catch (error) {
    console.error("refund issued but audit note failed", error, { orderId: order.id });
  }

  return json({ ok: true });
};
