import { describe, expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@/lib/orders", () => ({
  findOrderByToken: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

describe("GET /api/booking/[token]/invoice", () => {
  it("returns 404 if order does not exist", async () => {
    const { findOrderByToken } = await import("@/lib/orders");
    vi.mocked(findOrderByToken).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/booking/bad-token/invoice"), {
      params: Promise.resolve({ token: "bad-token" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 if order is not paid", async () => {
    const { findOrderByToken } = await import("@/lib/orders");
    vi.mocked(findOrderByToken).mockResolvedValue({
      id: 1,
      orderNumber: "MS-2026-TEST",
      status: "pending",
      stripe: { checkoutSessionId: "cs_123" },
    } as never);

    const res = await GET(new Request("http://localhost/api/booking/valid-token/invoice"), {
      params: Promise.resolve({ token: "valid-token" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns 503 if stripe is not configured", async () => {
    const { findOrderByToken } = await import("@/lib/orders");
    const { getStripe } = await import("@/lib/stripe");

    vi.mocked(findOrderByToken).mockResolvedValue({
      id: 1,
      orderNumber: "MS-2026-TEST",
      status: "paid",
      stripe: { checkoutSessionId: "cs_123" },
    } as never);

    vi.mocked(getStripe).mockReturnValue(null);

    const res = await GET(new Request("http://localhost/api/booking/valid-token/invoice"), {
      params: Promise.resolve({ token: "valid-token" }),
    });

    expect(res.status).toBe(503);
  });
});
