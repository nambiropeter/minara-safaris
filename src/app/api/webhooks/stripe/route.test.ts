import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { create: vi.fn(), find: vi.fn(), findByID: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { current: null as unknown },
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => h.db) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: () => h.event.current } }),
}));
vi.mock("@/lib/notify-order", () => ({
  notifyOrderPaid: vi.fn(async () => {}),
  notifyStaff: vi.fn(async () => {}),
}));

import { notifyOrderPaid, notifyStaff } from "@/lib/notify-order";
import { POST } from "./route";

const pendingOrder = {
  id: 7,
  orderNumber: "MS-2026-TEST",
  status: "pending",
  customerEmail: "a@example.com",
  amountTotal: 200000,
  currency: "KES",
  items: [{ title: "Mara", quantity: 2 }],
  staffNotes: null,
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    payment_status: "paid",
    amount_total: 200000,
    currency: "kes",
    payment_intent: "pi_1",
    customer_details: { email: "a@example.com" },
    metadata: { orderId: "7", bookingToken: "tok" },
    ...overrides,
  };
}

function send(type: string, object: unknown) {
  h.event.current = { id: "evt_1", type, data: { object } };
  return POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=x" },
      body: "{}",
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  vi.spyOn(console, "error").mockImplementation(() => {});
  h.db.create.mockResolvedValue({ id: 1 });
  h.db.find.mockResolvedValue({ docs: [] });
  h.db.findByID.mockResolvedValue(pendingOrder);
  h.db.update.mockImplementation(async ({ data }) => ({ ...pendingOrder, ...data }));
  h.db.delete.mockResolvedValue({});
});

describe("event recording", () => {
  it("acknowledges a genuine duplicate without acting", async () => {
    h.db.create.mockRejectedValueOnce(new Error("duplicate key"));
    h.db.find.mockResolvedValueOnce({ docs: [{ id: 1 }] });

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.db.update).not.toHaveBeenCalled();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("returns 500 when recording fails and the event was never recorded", async () => {
    h.db.create.mockRejectedValueOnce(new Error("connection reset"));

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(500);
    expect(h.db.update).not.toHaveBeenCalled();
  });
});

describe("checkout.session.completed", () => {
  it("marks a pending order paid and notifies customer and staff", async () => {
    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, data: expect.objectContaining({ status: "paid" }) }),
    );
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }), "tok");
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("MS-2026-TEST"), expect.any(String));
  });

  it("ignores an unpaid completion", async () => {
    await send("checkout.session.completed", session({ payment_status: "unpaid" }));
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("does not re-fulfil an order that is already paid", async () => {
    h.db.findByID.mockResolvedValueOnce({ ...pendingOrder, status: "paid" });
    await send("checkout.session.completed", session());
    expect(h.db.update).not.toHaveBeenCalled();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("acknowledges an unknown order instead of retrying forever", async () => {
    h.db.findByID.mockResolvedValueOnce(null);
    const res = await send("checkout.session.completed", session());
    expect(res.status).toBe(200);
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("refuses a mismatched amount, fails the order and alerts staff", async () => {
    await send("checkout.session.completed", session({ amount_total: 1 }));
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("refused"), expect.any(String));
  });

  it("still acknowledges when the confirmation email fails, and logs it", async () => {
    vi.mocked(notifyOrderPaid).mockRejectedValueOnce(new Error("resend down"));
    const res = await send("checkout.session.completed", session());
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith(
      "booking confirmation email failed",
      expect.any(Error),
      expect.anything(),
    );
  });
});
