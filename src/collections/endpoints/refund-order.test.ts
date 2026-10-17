import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { findByID: vi.fn(), update: vi.fn() },
  refundsCreate: vi.fn(),
  retrieve: vi.fn(),
  cancelBooking: vi.fn(),
  hb: { config: { apiKey: "k", secret: "s", baseUrl: "https://x" } as unknown },
}));

vi.mock("@/lib/hotelbeds", () => ({ getHotelbeds: () => h.hb.config, cancelBooking: h.cancelBooking }));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({ refunds: { create: h.refundsCreate }, paymentIntents: { retrieve: h.retrieve } })),
}));

import { refundOrder } from "@/collections/endpoints/refund-order";
import { getStripe } from "@/lib/stripe";

const order = {
  id: 7,
  orderNumber: "MS-2026-TEST",
  status: "paid",
  currency: "KES",
  amountTotal: 5800000,
  items: [{ kind: "package", subtotal: 5800000 }],
  staffNotes: null,
  stripe: { paymentIntentId: "pi_1" },
};

function req(over: Record<string, unknown> = {}) {
  return {
    user: { id: 1, email: "agent@minara.example" },
    routeParams: { id: "7" },
    payload: h.db,
    ...over,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.db.findByID.mockResolvedValue(order);
  h.db.update.mockResolvedValue({});
  h.refundsCreate.mockResolvedValue({ id: "re_1", status: "succeeded" });
});

describe("refundOrder", () => {
  it("rejects an unauthenticated caller before touching anything", async () => {
    const res = await refundOrder(req({ user: null }));
    expect(res.status).toBe(401);
    expect(h.db.findByID).not.toHaveBeenCalled();
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("404s an unknown order", async () => {
    h.db.findByID.mockResolvedValue(null);
    expect((await refundOrder(req())).status).toBe(404);
  });

  it.each(["pending", "failed", "cancelled"])("refuses to refund a %s order, because nothing was charged", async (status) => {
    h.db.findByID.mockResolvedValue({ ...order, status });
    const res = await refundOrder(req());
    expect(res.status).toBe(409);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("says so when the order is already refunded, and does not call Stripe", async () => {
    h.db.findByID.mockResolvedValue({ ...order, status: "refunded" });
    const res = await refundOrder(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already been refunded/i);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("refuses an order with no recorded Stripe payment", async () => {
    h.db.findByID.mockResolvedValue({ ...order, stripe: {} });
    expect((await refundOrder(req())).status).toBe(409);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("503s when Stripe is not configured", async () => {
    vi.mocked(getStripe).mockReturnValueOnce(null);
    expect((await refundOrder(req())).status).toBe(503);
  });

  it("refunds the whole payment, once-only, and a confirmed order counts as paid", async () => {
    h.db.findByID.mockResolvedValue({ ...order, status: "confirmed" });
    const res = await refundOrder(req());

    expect(res.status).toBe(200);
    expect(h.refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_1", metadata: { orderId: "7", requestedBy: "agent@minara.example" } },
      { idempotencyKey: "refund-order-7" },
    );
    // No `amount`: Stripe refunds what is left, in full.
    expect(h.refundsCreate.mock.calls[0][0].amount).toBeUndefined();
  });

  it("records who asked, but leaves the status to the charge.refunded webhook", async () => {
    await refundOrder(req());
    const data = h.db.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(data.staffNotes).toContain("Refund of KES 58,000.00 requested by agent@minara.example");
  });

  it("reports the amount refunded, and does not log the same refund twice when it is repeated", async () => {
    const first = await (await refundOrder(req())).json();
    expect(first).toEqual({ ok: true, amount: "KES 58,000.00" });

    h.db.update.mockClear();
    h.db.findByID.mockResolvedValue({ ...order, staffNotes: "Refund of KES 58,000.00 requested by agent@minara.example." });
    expect((await refundOrder(req())).status).toBe(200);
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("still reports success if the audit note cannot be saved, since the money has already moved", async () => {
    h.db.update.mockRejectedValue(new Error("db down"));
    const res = await refundOrder(req());
    expect(res.status).toBe(200);
  });

  it("maps Stripe's 'already refunded' to a clear 409", async () => {
    h.refundsCreate.mockRejectedValue(Object.assign(new Error("Charge already refunded"), { code: "charge_already_refunded" }));
    const res = await refundOrder(req());
    expect(res.status).toBe(409);
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("passes any other Stripe failure back as a 502 with its message, and writes no note", async () => {
    h.refundsCreate.mockRejectedValue(new Error("Stripe is down"));
    const res = await refundOrder(req());
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Stripe is down");
    expect(h.db.update).not.toHaveBeenCalled();
  });
});

describe("refundOrder: hotel orders", () => {
  const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const PAST = "2020-01-01T00:00:00Z";
  const hotel = (supplier: Record<string, unknown> = {}) => ({
    ...order,
    supplier: {
      name: "hotelbeds",
      status: "booked",
      reference: "286-264500",
      cancellationPolicies: [{ from: FUTURE, amount: 5800000 }],
      ...supplier,
    },
  });

  beforeEach(() => {
    h.hb.config = { apiKey: "k", secret: "s", baseUrl: "https://x" };
    h.cancelBooking.mockResolvedValue({ outcome: "cancelled", feeNet: 0 });
  });

  it("cancels with Hotelbeds first, records it, and only then refunds in full", async () => {
    h.db.findByID.mockResolvedValue(hotel());
    const order_of_calls: string[] = [];
    h.cancelBooking.mockImplementation(async () => (order_of_calls.push("cancel"), { outcome: "cancelled", feeNet: 0 }));
    h.refundsCreate.mockImplementation(async () => (order_of_calls.push("refund"), { id: "re_1" }));

    const res = await refundOrder(req());

    expect(res.status).toBe(200);
    expect(order_of_calls).toEqual(["cancel", "refund"]);
    expect(h.cancelBooking).toHaveBeenCalledWith(expect.anything(), "286-264500");
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { supplier: { status: "cancelled", note: expect.stringContaining("agent@minara.example") } } }),
    );
  });

  it("refuses when the booking has cancellation fees, touching neither Hotelbeds nor Stripe", async () => {
    h.db.findByID.mockResolvedValue(hotel({ cancellationPolicies: [{ from: PAST, amount: 5800000 }] }));

    const res = await refundOrder(req());

    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("cancellation fees");
    expect(h.cancelBooking).not.toHaveBeenCalled();
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("refunds nothing if the booking can't be cancelled", async () => {
    h.db.findByID.mockResolvedValue(hotel());
    h.cancelBooking.mockResolvedValue({ outcome: "failed", reason: "still CONFIRMED" });

    const res = await refundOrder(req());

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("nothing was refunded");
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("refunds nothing if it can't tell whether the booking was cancelled", async () => {
    h.db.findByID.mockResolvedValue(hotel());
    h.cancelBooking.mockResolvedValue({ outcome: "unknown", reason: "no answer" });
    expect((await refundOrder(req())).status).toBe(502);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("does not cancel twice when retrying a refund that failed after the cancellation", async () => {
    h.db.findByID.mockResolvedValue(hotel({ status: "cancelled" }));

    const res = await refundOrder(req());

    expect(res.status).toBe(200);
    expect(h.cancelBooking).not.toHaveBeenCalled();
    expect(h.refundsCreate).toHaveBeenCalled();
  });

  it("lets staff refund an order Hotelbeds refused, when the automatic refund didn't go through", async () => {
    h.db.findByID.mockResolvedValue(hotel({ status: "failed", reference: undefined }));
    expect((await refundOrder(req())).status).toBe(200);
    expect(h.cancelBooking).not.toHaveBeenCalled();
  });

  it("won't refund while the booking's state is unknown or in flight: someone checks Hotelbeds first", async () => {
    for (const status of ["unknown", "booking", "pending"]) {
      h.db.findByID.mockResolvedValue(hotel({ status }));
      const res = await refundOrder(req());
      expect(res.status).toBe(409);
      expect((await res.json()).error).toContain("MS-2026-TEST");
    }
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("can't cancel without Hotelbeds configured, and says so", async () => {
    h.db.findByID.mockResolvedValue(hotel());
    h.hb.config = null;
    expect((await refundOrder(req())).status).toBe(503);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("leaves package orders exactly as they were", async () => {
    h.db.findByID.mockResolvedValue(order);
    expect((await refundOrder(req())).status).toBe(200);
    expect(h.cancelBooking).not.toHaveBeenCalled();
  });
});

describe("refundOrder: package + hotel bundles", () => {
  const bundle = (supplier: Record<string, unknown>) => ({
    ...order,
    amountTotal: 6686200,
    items: [
      { kind: "package", subtotal: 1800000 },
      { kind: "hotel", subtotal: 4886200 },
    ],
    supplier: { name: "hotelbeds", status: "booked", reference: "286-1", cancellationPolicies: [{ from: new Date(Date.now() + 86_400_000).toISOString(), amount: 1 }], ...supplier },
  });
  const stripeHolds = (amount: number, refunded: number) => h.retrieve.mockResolvedValue({ latest_charge: { amount, amount_refunded: refunded } });

  beforeEach(() => {
    h.hb.config = { apiKey: "k", secret: "s", baseUrl: "https://x" };
    h.cancelBooking.mockResolvedValue({ outcome: "cancelled", feeNet: 0 });
  });

  it("cancels the hotel, then refunds everything Stripe still holds", async () => {
    h.db.findByID.mockResolvedValue(bundle({}));
    stripeHolds(6686200, 0);
    expect((await refundOrder(req())).status).toBe(200);
    expect(h.cancelBooking).toHaveBeenCalledOnce();
    expect(h.refundsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 6686200 }), expect.anything());
  });

  it("after a refused hotel was already refunded, refunds only the package's part and cancels nothing", async () => {
    h.db.findByID.mockResolvedValue(bundle({ status: "failed" }));
    stripeHolds(6686200, 4886200);
    expect((await refundOrder(req())).status).toBe(200);
    expect(h.cancelBooking).not.toHaveBeenCalled();
    expect(h.refundsCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 1800000 }), expect.anything());
  });

  it("refuses when nothing is left to refund", async () => {
    h.db.findByID.mockResolvedValue(bundle({ status: "failed" }));
    stripeHolds(6686200, 6686200);
    expect((await refundOrder(req())).status).toBe(409);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("a hotel-only order is still refunded without an explicit amount", async () => {
    h.db.findByID.mockResolvedValue({ ...order, items: [{ kind: "hotel", subtotal: 5800000 }], supplier: { name: "hotelbeds", status: "failed" } });
    await refundOrder(req());
    expect(h.refundsCreate.mock.calls[0][0]).not.toHaveProperty("amount");
    expect(h.retrieve).not.toHaveBeenCalled();
  });
});

