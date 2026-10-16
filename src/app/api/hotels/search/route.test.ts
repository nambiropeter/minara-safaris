import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  searchHotels: vi.fn(),
  getKesRates: vi.fn(),
  config: { current: { apiKey: "k", secret: "s", baseUrl: "https://x" } as unknown },
}));

vi.mock("@/lib/hotelbeds", () => ({ getHotelbeds: () => h.config.current }));
vi.mock("@/lib/hotel-search", () => ({ searchHotels: h.searchHotels }));
vi.mock("@/lib/exchange-rates", () => ({ getKesRates: h.getKesRates }));

import { issueSession, SESSION_COOKIE } from "@/lib/hotel-session";
import { POST } from "./route";

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const valid = { destination: "nai", checkIn: day(10), checkOut: day(13), adults: 2 };

let ip = 0;
function call(body: unknown, session: string | null = issueSession(Date.now() - 5000)) {
  return POST(
    new NextRequest("http://localhost/api/hotels/search", {
      method: "POST",
      // A fresh IP per call keeps the in-memory rate limiter from bleeding across tests.
      headers: { "x-forwarded-for": `10.0.0.${++ip}`, ...(session && { cookie: `${SESSION_COOKIE}=${session}` }) },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/hotels/search", () => {
  beforeEach(() => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "1500");
    h.config.current = { apiKey: "k", secret: "s", baseUrl: "https://x" };
    h.searchHotels.mockReset();
    h.getKesRates.mockReset();
    // 1 EUR = 150 KES
    h.getKesRates.mockResolvedValue({ usdPerKes: 0.0077, eurPerKes: 1 / 150, updatedAt: "" });
    h.searchHotels.mockResolvedValue([
      { code: 7, name: "Hotel A", category: "4 STARS", destination: "Nairobi", zone: "Westlands", currency: "EUR", netFrom: 100 },
    ]);
  });

  it("is unavailable without credentials", async () => {
    h.config.current = null;
    expect((await call(valid)).status).toBe(503);
  });

  it("rejects a request with no session cookie, a forged one, or one that is too new", async () => {
    expect((await call(valid, null)).status).toBe(401);
    expect((await call(valid, "a.1.forged")).status).toBe(401);
    expect((await call(valid, issueSession(Date.now()))).status).toBe(429);
    expect(h.searchHotels).not.toHaveBeenCalled();
  });

  it("returns margin-inclusive prices converted from EUR, and never the net", async () => {
    const response = await call({ ...valid, currency: "KES" });
    expect(response.status).toBe(200);
    const body = await response.json();
    // EUR 100 net + 15% = EUR 115 = KES 17,250 -> minor units
    expect(body).toEqual({
      nights: 3,
      currency: "KES",
      hotels: [{ code: 7, name: "Hotel A", category: "4 STARS", destination: "Nairobi", zone: "Westlands", from: 1_725_000 }],
    });
    expect(JSON.stringify(body)).not.toContain("netFrom");
    expect(h.searchHotels).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ destination: "NAI" }));
  });

  it("passes a zone through to the search", async () => {
    await call({ ...valid, destination: "MBA", zone: 9 });
    expect(h.searchHotels).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ destination: "MBA", zone: 9 }));
  });

  it("refuses a client-supplied price or rate, and bad dates", async () => {
    expect((await call({ ...valid, price: 1 })).status).toBe(400);
    expect((await call({ ...valid, rate: 0.5 })).status).toBe(400);
    expect((await call({ ...valid, checkOut: valid.checkIn })).status).toBe(400);
    expect((await call({ ...valid, checkIn: day(-2), checkOut: day(1) })).status).toBe(400);
    expect((await call({ ...valid, checkIn: day(10), checkOut: day(60) })).status).toBe(400);
    expect(h.searchHotels).not.toHaveBeenCalled();
  });

  it("drops a hotel quoted in anything but EUR instead of mispricing it", async () => {
    h.searchHotels.mockResolvedValue([
      { code: 1, name: "A", category: "", destination: "", zone: "", currency: "USD", netFrom: 100 },
      { code: 2, name: "B", category: "", destination: "", zone: "", currency: "EUR", netFrom: 100 },
    ]);
    const body = await (await call(valid)).json();
    expect(body.hotels.map((x: { code: number }) => x.code)).toEqual([2]);
  });

  it("will not show a price when there is no euro rate", async () => {
    h.getKesRates.mockResolvedValue({ usdPerKes: 0.0077, updatedAt: "" });
    expect((await call(valid)).status).toBe(503);
  });

  it("is unavailable when the margin is not configured, rather than selling at cost", async () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "");
    expect((await call(valid)).status).toBe(503);
  });

  it("turns a supplier failure into a 502", async () => {
    h.searchHotels.mockRejectedValue(new Error("boom"));
    expect((await call(valid)).status).toBe(502);
  });
});
