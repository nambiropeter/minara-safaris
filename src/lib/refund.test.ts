import { describe, expect, it, vi } from "vitest";

import { refundPayment } from "./refund";

const args = { paymentIntentId: "pi_1", orderId: 7, idempotencyKey: "refund-order-7-auto", requestedBy: "system" };
const stripeWith = (create: unknown) => ({ refunds: { create } }) as never;

describe("refundPayment", () => {
  it("asks Stripe for a full refund once, naming the order and who asked", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_1" });

    expect(await refundPayment(stripeWith(create), args)).toEqual({ ok: true });

    expect(create).toHaveBeenCalledWith(
      { payment_intent: "pi_1", metadata: { orderId: "7", requestedBy: "system" } },
      { idempotencyKey: "refund-order-7-auto" },
    );
  });

  it("reports an already-refunded charge as its own case, not a failure", async () => {
    const create = vi.fn().mockRejectedValue({ code: "charge_already_refunded", message: "x" });
    expect(await refundPayment(stripeWith(create), args)).toEqual({ ok: false, reason: "already_refunded" });
  });

  it("hands any other Stripe failure back with its message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const create = vi.fn().mockRejectedValue({ message: "insufficient balance" });
    expect(await refundPayment(stripeWith(create), args)).toEqual({ ok: false, reason: "failed", message: "insufficient balance" });
  });
});
