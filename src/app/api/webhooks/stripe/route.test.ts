import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { create: vi.fn(), find: vi.fn(), findByID: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { current: null as unknown },
  bookRoom: vi.fn(),
  refund: vi.fn(),
  hb: { config: { apiKey: "k", secret: "s", baseUrl: "https://x" } as unknown },
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => h.db) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: () => h.event.current } }),
}));
vi.mock("@/lib/notify-order", () => ({
  notifyOrderPaid: vi.fn(async () => {}),
  notifyStaff: vi.fn(async () => {}),
  notifyHotelRefused: vi.fn(async () => {}),
}));
vi.mock("@/lib/hotelbeds", () => ({ getHotelbeds: () => h.hb.config, bookRoom: h.bookRoom }));
vi.mock("@/lib/refund", () => ({ refundPayment: h.refund }));

import { notifyHotelRefused, notifyOrderPaid, notifyStaff } from "@/lib/notify-order";
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

  it("does not resurrect a cancelled order: no paid status, staff told to refund", async () => {
    h.db.findByID.mockResolvedValueOnce({ ...pendingOrder, status: "cancelled" });
    await send("checkout.session.completed", session());
    expect(h.db.update).not.toHaveBeenCalled();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("inactive"), expect.any(String));
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

describe("payment lifecycle", () => {
  it("marks paid when a delayed payment succeeds", async () => {
    await send("checkout.session.async_payment_succeeded", session());
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "paid" }) }),
    );
  });

  it("fails a pending order when a delayed payment fails", async () => {
    await send("checkout.session.async_payment_failed", session({ payment_status: "unpaid" }));
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("cancels a pending order when checkout expires", async () => {
    await send("checkout.session.expired", session({ payment_status: "unpaid" }));
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
    );
  });

  it("never lets a late expiry undo a payment", async () => {
    h.db.findByID.mockResolvedValueOnce({ ...pendingOrder, status: "paid" });
    await send("checkout.session.expired", session({ payment_status: "unpaid" }));
    expect(h.db.update).not.toHaveBeenCalled();
  });

  it("marks a fully refunded order refunded", async () => {
    h.db.find.mockResolvedValueOnce({ docs: [{ ...pendingOrder, status: "confirmed" }] });
    await send("charge.refunded", { payment_intent: "pi_1", refunded: true, amount_refunded: 200000 });
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "refunded" }) }),
    );
    expect(notifyStaff).toHaveBeenCalled();
  });

  it("keeps the booking live on a partial refund", async () => {
    h.db.find.mockResolvedValueOnce({ docs: [{ ...pendingOrder, status: "confirmed" }] });
    await send("charge.refunded", { payment_intent: "pi_1", refunded: false, amount_refunded: 5000 });
    const data = h.db.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(data.staffNotes).toContain("Partially refunded");
  });
});

describe("hotel orders", () => {
  const hotelOrder = {
    ...pendingOrder,
    items: [{ kind: "hotel", title: "The Boma, Superior room, room only, 3 nights", quantity: 1 }],
    supplier: {
      name: "hotelbeds",
      status: "pending",
      rateKey: "KEY|1+2/=",
      netAmount: 100,
      guests: [
        { type: "AD", name: "Amina", surname: "Otieno" },
        { type: "CH", name: "Zuri", surname: "Otieno", age: 7 },
      ],
    },
  };
  const booking = {
    reference: "286-264500",
    clientReference: "MS-2026-TEST",
    status: "CONFIRMED",
    totalNet: 100,
    currency: "EUR",
    supplierName: "HOTELBEDS SPAIN S.L.U.",
    supplierVat: "ESB28916765",
  };

  const statusUpdates = () => h.db.update.mock.calls.map(([arg]) => arg.data);
  const supplierUpdates = () => statusUpdates().filter((d) => d.supplier).map((d) => d.supplier);

  beforeEach(() => {
    h.hb.config = { apiKey: "k", secret: "s", baseUrl: "https://x" };
    h.db.findByID.mockResolvedValue(hotelOrder);
    h.db.update.mockImplementation(async ({ data }) => ({ ...hotelOrder, ...data }));
    h.bookRoom.mockResolvedValue({ outcome: "booked", booking });
    h.refund.mockResolvedValue({ ok: true });
  });

  it("records the payment first, then books with our reference, the key untouched, and every guest", async () => {
    await send("checkout.session.completed", session());

    expect(statusUpdates()[0].status).toBe("paid");
    expect(h.bookRoom).toHaveBeenCalledWith(expect.anything(), {
      clientReference: "MS-2026-TEST",
      rateKey: "KEY|1+2/=",
      holder: { name: "Amina", surname: "Otieno" },
      guests: hotelOrder.supplier.guests,
    });
  });

  it("marks the attempt before calling Hotelbeds, so a crash mid-booking leaves a trace", async () => {
    let seenBeforeCall: unknown;
    h.bookRoom.mockImplementation(async () => {
      seenBeforeCall = supplierUpdates()[0];
      return { outcome: "booked", booking };
    });

    await send("checkout.session.completed", session());

    expect(seenBeforeCall).toEqual({ status: "booking", clientReference: "MS-2026-TEST" });
  });

  it("confirms the order, keeps the reference and who the guest pays, and tells everyone", async () => {
    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    const confirm = statusUpdates().find((d) => d.status === "confirmed");
    expect(confirm.supplier).toMatchObject({
      status: "booked",
      reference: "286-264500",
      bookedNetAmount: 100,
      payableTo: "HOTELBEDS SPAIN S.L.U., VAT ESB28916765",
    });
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed" }), "tok");
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("New hotel booking"), expect.stringContaining("286-264500"));
    expect(h.refund).not.toHaveBeenCalled();
  });

  it("flags a booking made above the quoted net, since that eats the margin", async () => {
    h.bookRoom.mockResolvedValue({ outcome: "booked", booking: { ...booking, totalNet: 103 } });
    await send("checkout.session.completed", session());
    expect(statusUpdates().find((d) => d.status === "confirmed").supplier.note).toContain("lower than planned");
  });

  it("refunds, tells the customer and staff, and never confirms, when Hotelbeds definitely refused", async () => {
    h.bookRoom.mockResolvedValue({ outcome: "rejected", reason: "PRODUCT_NOT_AVAILABLE" });

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.refund).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      paymentIntentId: "pi_1",
      orderId: 7,
      idempotencyKey: "refund-order-7-auto",
    }));
    expect(supplierUpdates().at(-1)).toMatchObject({ status: "failed", note: expect.stringContaining("Refunded automatically") });
    expect(statusUpdates().some((d) => d.status === "confirmed")).toBe(false);
    expect(notifyHotelRefused).toHaveBeenCalled();
    expect(notifyOrderPaid).not.toHaveBeenCalled();
  });

  it("raises the alarm when Hotelbeds refused AND the refund failed, without telling the customer they're refunded", async () => {
    h.bookRoom.mockResolvedValue({ outcome: "rejected", reason: "sold out" });
    h.refund.mockResolvedValue({ ok: false, reason: "failed", message: "balance" });

    await send("checkout.session.completed", session());

    expect(supplierUpdates().at(-1).note).toContain("AUTOMATIC REFUND FAILED");
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("URGENT"), expect.any(String));
    expect(notifyHotelRefused).not.toHaveBeenCalled();
  });

  it("treats a refund that Stripe says already happened as done", async () => {
    h.bookRoom.mockResolvedValue({ outcome: "rejected", reason: "sold out" });
    h.refund.mockResolvedValue({ ok: false, reason: "already_refunded" });
    await send("checkout.session.completed", session());
    expect(supplierUpdates().at(-1).note).toContain("Refunded automatically");
  });

  it("does NOT refund or rebook when it cannot tell whether Hotelbeds booked: a human checks", async () => {
    h.bookRoom.mockResolvedValue({ outcome: "unknown", reason: "timed out; lookup failed" });

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.refund).not.toHaveBeenCalled();
    expect(h.bookRoom).toHaveBeenCalledTimes(1);
    expect(supplierUpdates().at(-1)).toMatchObject({ status: "unknown", note: expect.stringContaining("MS-2026-TEST") });
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("URGENT"), expect.stringContaining("Do NOT refund"));
    expect(statusUpdates().some((d) => d.status === "confirmed")).toBe(false);
    // The customer is told what is true: paid, being confirmed.
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }), "tok");
  });

  /** Makes the mocked database serve, and update, this particular stored order. */
  const store = (order: unknown) => {
    h.db.findByID.mockResolvedValue(order);
    h.db.update.mockImplementation(async ({ data }) => ({ ...(order as object), ...data }));
  };

  it("does not attempt a booking it has no guests for, and says so", async () => {
    store({ ...hotelOrder, supplier: { ...hotelOrder.supplier, guests: [] } });
    await send("checkout.session.completed", session());
    expect(h.bookRoom).not.toHaveBeenCalled();
    expect(h.refund).not.toHaveBeenCalled();
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("URGENT"), expect.any(String));
  });

  it("does not attempt a booking without Hotelbeds credentials, and says so", async () => {
    h.hb.config = null;
    await send("checkout.session.completed", session());
    expect(h.bookRoom).not.toHaveBeenCalled();
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("URGENT"), expect.any(String));
  });

  it("does not book if it cannot even record the attempt", async () => {
    h.db.update
      .mockImplementationOnce(async ({ data }) => ({ ...hotelOrder, ...data })) // paid
      .mockRejectedValueOnce(new Error("db down")); // the marker

    const res = await send("checkout.session.completed", session());

    expect(res.status).toBe(200);
    expect(h.bookRoom).not.toHaveBeenCalled();
    expect(notifyStaff).toHaveBeenCalledWith(expect.stringContaining("URGENT"), expect.any(String));
  });

  it("never books twice: a redelivered event for an already-paid order does nothing", async () => {
    h.db.findByID.mockResolvedValue({ ...hotelOrder, status: "paid" });
    await send("checkout.session.completed", session());
    expect(h.bookRoom).not.toHaveBeenCalled();
  });

  it("still answers 200 if the booking step blows up in a way nothing anticipated", async () => {
    h.bookRoom.mockRejectedValue(new Error("unexpected"));
    const res = await send("checkout.session.completed", session());
    expect(res.status).toBe(200);
    expect(console.error).toHaveBeenCalledWith("hotel fulfilment failed unexpectedly", expect.any(Error), expect.anything());
  });

  it("never touches Hotelbeds for a package order", async () => {
    h.db.findByID.mockResolvedValue(pendingOrder);
    h.db.update.mockImplementation(async ({ data }) => ({ ...pendingOrder, ...data }));
    await send("checkout.session.completed", session());
    expect(h.bookRoom).not.toHaveBeenCalled();
    expect(notifyOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }), "tok");
  });
});
