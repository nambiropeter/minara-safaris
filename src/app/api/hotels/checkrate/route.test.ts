import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  checkRate: vi.fn(),
  getKesRates: vi.fn(),
  config: { current: { apiKey: "k", secret: "s", baseUrl: "https://x" } as unknown },
}));

vi.mock("@/lib/hotelbeds", async () => ({
  ...(await vi.importActual<typeof import("@/lib/hotelbeds")>("@/lib/hotelbeds")),
  getHotelbeds: () => h.config.current,
  checkRate: h.checkRate,
}));
vi.mock("@/lib/exchange-rates", () => ({ getKesRates: h.getKesRates }));

import { HotelbedsError } from "@/lib/hotelbeds";
import { issueSession, SESSION_COOKIE } from "@/lib/hotel-session";
import { POST } from "./route";

const rateKey = "20270301|W|1|7|DBL.ST|ID_B2B_26|RO||1~2~0||N@AB+/=";
let ip = 0;
function call(body: unknown, session: string | null = issueSession(Date.now() - 5000)) {
  return POST(
    new NextRequest("http://localhost/api/hotels/checkrate", {
      method: "POST",
      headers: { "x-forwarded-for": `10.1.0.${++ip}`, ...(session && { cookie: `${SESSION_COOKIE}=${session}` }) },
      body: JSON.stringify(body),
    }),
  );
}

const checked = (over: Record<string, unknown> = {}) => ({
  currency: "EUR",
  rate: {
    rateKey: "REISSUED",
    rateType: "BOOKABLE",
    net: 100,
    boardCode: "BB",
    boardName: "BED AND BREAKFAST",
    paymentType: "AT_WEB",
    cancellationPolicies: [{ amount: 100, from: "2000-01-01T00:00:00Z" }],
    ...over,
  },
});

describe("POST /api/hotels/checkrate", () => {
  beforeEach(() => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "1500");
    h.config.current = { apiKey: "k", secret: "s", baseUrl: "https://x" };
    h.checkRate.mockReset();
    h.getKesRates.mockReset();
    h.getKesRates.mockResolvedValue({ usdPerKes: 0.0077, eurPerKes: 1 / 150, updatedAt: "" });
    h.checkRate.mockResolvedValue(checked());
  });

  it("needs a session", async () => {
    expect((await call({ rateKey, shownFrom: 1, currency: "KES" }, null)).status).toBe(401);
    expect(h.checkRate).not.toHaveBeenCalled();
  });

  it("passes the rateKey through untouched and returns the reissued key", async () => {
    const response = await call({ rateKey, shownFrom: 1_725_000, currency: "KES" });
    expect(h.checkRate).toHaveBeenCalledWith(expect.anything(), rateKey);
    const body = await response.json();
    expect(body.rateKey).toBe("REISSUED");
    expect(body.from).toBe(1_725_000);
    expect(body.priceChanged).toBe(false);
    expect(body.board).toEqual({ code: "BB", name: "BED AND BREAKFAST" });
    expect(body.cancellation.freeCancellationUntil).toBeNull();
    expect(JSON.stringify(body)).not.toContain('"net"');
  });

  it("says when the price moved and what it was", async () => {
    const body = await (await call({ rateKey, shownFrom: 1_500_000, currency: "KES" })).json();
    expect(body.priceChanged).toBe(true);
    expect(body.previousFrom).toBe(1_500_000);
    expect(body.from).toBe(1_725_000);
  });

  it("does not treat the client's shownFrom as a price", async () => {
    const body = await (await call({ rateKey, shownFrom: 1, currency: "KES" })).json();
    expect(body.from).toBe(1_725_000);
  });

  it("refuses a rate that is still not bookable after the recheck", async () => {
    h.checkRate.mockResolvedValue(checked({ rateType: "RECHECK" }));
    expect((await call({ rateKey, shownFrom: 1, currency: "KES" })).status).toBe(409);
  });

  it("maps an expired rate to 409 but a supplier outage to 502", async () => {
    h.checkRate.mockRejectedValue(new HotelbedsError(400, "rate expired"));
    expect((await call({ rateKey, shownFrom: 1, currency: "KES" })).status).toBe(409);
    h.checkRate.mockRejectedValue(new HotelbedsError(401, "bad signature"));
    expect((await call({ rateKey, shownFrom: 1, currency: "KES" })).status).toBe(502);
    h.checkRate.mockRejectedValue(new HotelbedsError(500, "down"));
    expect((await call({ rateKey, shownFrom: 1, currency: "KES" })).status).toBe(502);
  });

  it("rejects extra fields, an empty key and a fractional shown price", async () => {
    expect((await call({ rateKey, shownFrom: 1, price: 5 })).status).toBe(400);
    expect((await call({ rateKey: "", shownFrom: 1 })).status).toBe(400);
    expect((await call({ rateKey, shownFrom: 1.5 })).status).toBe(400);
  });

  it("will not price a non-EUR response", async () => {
    h.checkRate.mockResolvedValue({ ...checked(), currency: "USD" });
    expect((await call({ rateKey, shownFrom: 1, currency: "KES" })).status).toBe(502);
  });
});
