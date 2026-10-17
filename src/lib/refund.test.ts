import { describe, expect, it, vi } from "vitest";

import { refundableAmount, refundPayment } from "./refund";

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

  it("refunds only the given amount when asked for a part", async () => {
    const create = vi.fn().mockResolvedValue({ id: "re_2" });

    await refundPayment(stripeWith(create), { ...args, amount: 4886200, idempotencyKey: "refund-order-7-auto-hotel" });

    expect(create).toHaveBeenCalledWith(
      { payment_intent: "pi_1", amount: 4886200, metadata: { orderId: "7", requestedBy: "system" } },
      { idempotencyKey: "refund-order-7-auto-hotel" },
    );
  });
});

describe("refundableAmount", () => {
  it("is the charge minus what has already been refunded", async () => {
    const retrieve = vi.fn().mockResolvedValue({ latest_charge: { amount: 6686200, amount_refunded: 4886200 } });
    expect(await refundableAmount({ paymentIntents: { retrieve } } as never, "pi_1")).toBe(1800000);
    expect(retrieve).toHaveBeenCalledWith("pi_1", { expand: ["latest_charge"] });
  });
});
