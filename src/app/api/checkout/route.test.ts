import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  db: { find: vi.fn(), create: vi.fn(), update: vi.fn() },
  sessionsCreate: vi.fn(),
}));

vi.mock("@payload-config", () => ({ default: {} }));
vi.mock("payload", () => ({ getPayload: vi.fn(async () => h.db) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({ checkout: { sessions: { create: h.sessionsCreate } } })),
}));

import { getStripe } from "@/lib/stripe";
import { POST } from "./route";

const validBody = {
  items: [{ kind: "package", refId: "1", quantity: 2 }],
  customerName: "Test",
  customerEmail: "test@example.com",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.db.find.mockResolvedValue({
    docs: [{ id: 1, title: "Mara", priceFrom: 1000, currency: "KES" }],
  });
  h.db.create.mockResolvedValue({ id: 7 });
  h.db.update.mockResolvedValue({});
  h.sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/x" });
});

describe("POST /api/checkout", () => {
  it("returns 503 when Stripe is not configured", async () => {
    vi.mocked(getStripe).mockReturnValueOnce(null);
    const res = await post(validBody);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Payments are not configured." });
  });

  it("rejects a top-level amount instead of ignoring it", async () => {
    const res = await post({ ...validBody, amount: 1 });
    expect(res.status).toBe(400);
    expect(h.db.create).not.toHaveBeenCalled();
  });

  it("rejects an amount smuggled into an item", async () => {
    const res = await post({
      ...validBody,
      items: [{ kind: "package", refId: "1", quantity: 1, unitAmount: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it("rejects a travel date that is not an ISO date", async () => {
    const res = await post({ ...validBody, travelDate: "next summer" });
    expect(res.status).toBe(400);
    expect(h.db.create).not.toHaveBeenCalled();
  });

  it("accepts an ISO travel date", async () => {
    const res = await post({ ...validBody, travelDate: "2026-12-01" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/x" });
  });

  it("accepts a booking with no travel date", async () => {
    const res = await post(validBody);
    expect(res.status).toBe(200);
  });

  it("prices from the catalogue, not the request", async () => {
    await post(validBody);
    expect(h.db.create.mock.calls[0][0].data.amountTotal).toBe(200000);
  });

  it("marks the order failed and returns 502 when Stripe errors", async () => {
    h.sessionsCreate.mockRejectedValueOnce(new Error("stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await post(validBody);

    expect(res.status).toBe(502);
    expect(h.db.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, data: expect.objectContaining({ status: "failed" }) }),
    );
  });
});
