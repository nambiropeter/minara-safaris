import type Stripe from "stripe";

/**
 * Imported by a collection endpoint, so: no path aliases, relative `.ts` imports only.
 *
 * Asks Stripe for a full refund. It deliberately does not touch the order: the
 * signature-verified `charge.refunded` webhook is the single writer of `refunded`, so a
 * refund from the admin button, from the webhook's own failure handling and one made in
 * the Stripe dashboard all land the same way.
 *
 * The idempotency key makes a retry or a double click a no-op. Callers use different keys
 * (`-auto` for the system) so one party's request is never mistaken for the other's, and
 * the second to arrive meets Stripe's `charge_already_refunded`.
 */
export type RefundResult =
  | { ok: true }
  | { ok: false; reason: "already_refunded" }
  | { ok: false; reason: "failed"; message: string };

export async function refundPayment(
  stripe: Pick<Stripe, "refunds">,
  args: { paymentIntentId: string; orderId: string | number; idempotencyKey: string; requestedBy: string },
): Promise<RefundResult> {
  try {
    await stripe.refunds.create(
      {
        payment_intent: args.paymentIntentId,
        metadata: { orderId: String(args.orderId), requestedBy: args.requestedBy },
      },
      { idempotencyKey: args.idempotencyKey },
    );
    return { ok: true };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    if (failure.code === "charge_already_refunded") return { ok: false, reason: "already_refunded" };
    console.error("refund failed", error, { orderId: args.orderId });
    return { ok: false, reason: "failed", message: failure.message ?? "Stripe could not issue the refund." };
  }
}
