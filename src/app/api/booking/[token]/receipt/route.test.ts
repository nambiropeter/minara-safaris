import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/orders", () => ({ findOrderByToken: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));

import { findOrderByToken } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { GET } from "./route";

const retrieve = vi.fn();

function get() {
  return GET(new Request("http://localhost/api/booking/tok/receipt"), {
    params: Promise.resolve({ token: "tok" }),
  });
}

function order(overrides: Record<string, unknown> = {}) {
  return { id: 1, status: "paid", stripe: { paymentIntentId: "pi_1" }, ...overrides } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStripe).mockReturnValue({ paymentIntents: { retrieve } } as never);
  retrieve.mockResolvedValue({ latest_charge: { receipt_url: "https://pay.stripe.com/receipts/x" } });
});

describe("GET /api/booking/[token]/receipt", () => {
  it("404s an unknown token", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });

  it("404s an order that was never charged", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order({ status: "pending" }));
    expect((await get()).status).toBe(404);
  });

  it("404s an order with no payment intent", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order({ stripe: {} }));
    expect((await get()).status).toBe(404);
  });

  it("503s when Stripe is not configured", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order());
    vi.mocked(getStripe).mockReturnValue(null);
    expect((await get()).status).toBe(503);
  });

  it("redirects a confirmed order to its Stripe receipt", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order({ status: "confirmed" }));
    const res = await get();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://pay.stripe.com/receipts/x");
    expect(retrieve).toHaveBeenCalledWith("pi_1", { expand: ["latest_charge"] });
  });

  it("404s when Stripe has no receipt for the charge", async () => {
    vi.mocked(findOrderByToken).mockResolvedValue(order());
    retrieve.mockResolvedValueOnce({ latest_charge: { receipt_url: null } });
    expect((await get()).status).toBe(404);
  });
});
