import { beforeEach, describe, expect, it, vi } from "vitest";

import { startCheckout } from "./start-checkout";

const db = { create: vi.fn(), update: vi.fn() };
const sessionsCreate = vi.fn();
const stripe = { checkout: { sessions: { create: sessionsCreate } } };

const order = {
  customerEmail: "a@example.com",
  items: [{ kind: "package" as const, refId: "1", title: "Mara", unitAmount: 100, quantity: 1, subtotal: 100 }],
  currency: "KES" as const,
  amountTotal: 100,
};
const lineItems = [{ quantity: 1, price_data: { currency: "kes", unit_amount: 100, product_data: { name: "Mara" } } }];

function run() {
  return startCheckout({ payload: db as never, stripe: stripe as never, origin: "https://site.test", cancelPath: "/packages", order, lineItems });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.create.mockResolvedValue({ id: 7 });
  db.update.mockResolvedValue({});
  sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.test/s" });
});

describe("startCheckout", () => {
  it("creates a pending order holding only a hash of the access token, then a session for it", async () => {
    const result = await run();

    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.test/s" });

    const data = db.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "pending", customerEmail: "a@example.com", amountTotal: 100 });
    expect(data.orderNumber).toMatch(/^MS-\d{4}-[0-9A-Z]+$/);

    const session = sessionsCreate.mock.calls[0][0];
    expect(session).toMatchObject({ mode: "payment", customer_email: "a@example.com", client_reference_id: "7", line_items: lineItems });
    expect(session.metadata.orderId).toBe("7");
    // The plaintext token goes to Stripe's metadata and the success URL, never into storage.
    expect(data.accessTokenHash).toBeTruthy();
    expect(data.accessTokenHash).not.toBe(session.metadata.bookingToken);
    expect(session.success_url).toBe(`https://site.test/booking/${session.metadata.bookingToken}?paid=1`);
    expect(session.cancel_url).toBe("https://site.test/packages");
  });

  it("records the session id on the order", async () => {
    await run();
    expect(db.update).toHaveBeenCalledWith({ collection: "orders", id: 7, data: { stripe: { checkoutSessionId: "cs_1" } } });
  });

  it("fails the order, rather than leaving it pending, when Stripe won't make a session", async () => {
    sessionsCreate.mockRejectedValue(new Error("stripe down"));

    expect(await run()).toEqual({ ok: false });

    expect(db.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, data: expect.objectContaining({ status: "failed" }) }),
    );
  });
});
