import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  hotelRates: vi.fn(),
  getKesRates: vi.fn(),
  settings: { current: { enabled: true, marginBps: 1500 } as { enabled: boolean; marginBps: number | null } },
  config: { current: { apiKey: "k", secret: "s", baseUrl: "https://x" } as unknown },
}));

vi.mock("@/lib/hotelbeds", () => ({ getHotelbeds: () => h.config.current }));
vi.mock("@/lib/hotel-search", () => ({ hotelRates: h.hotelRates }));
vi.mock("@/lib/exchange-rates", () => ({ getKesRates: h.getKesRates }));
vi.mock("@/lib/hotel-settings", () => ({ getHotelSettings: async () => h.settings.current }));

import { issueSession, SESSION_COOKIE } from "@/lib/hotel-session";
import { POST } from "./route";

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const valid = { hotelCode: 195976, checkIn: day(10), checkOut: day(13), adults: 2, currency: "KES" };
let ip = 0;
function call(body: unknown, session: string | null = issueSession(Date.now() - 5000)) {
  return POST(
    new NextRequest("http://localhost/api/hotels/rates", {
      method: "POST",
      headers: { "x-forwarded-for": `10.2.0.${++ip}`, ...(session && { cookie: `${SESSION_COOKIE}=${session}` }) },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/hotels/rates", () => {
  beforeEach(() => {
    h.settings.current = { enabled: true, marginBps: 1500 };
    h.config.current = { apiKey: "k", secret: "s", baseUrl: "https://x" };
    h.hotelRates.mockReset();
    h.getKesRates.mockReset();
    h.getKesRates.mockResolvedValue({ usdPerKes: 0.0077, eurPerKes: 1 / 150, updatedAt: "" });
    h.hotelRates.mockResolvedValue({
      code: 195976,
      name: "The Boma Nairobi",
      currency: "EUR",
      rooms: [
        {
          code: "DBL",
          name: "Double",
          rates: [
            {
              rateKey: "KEY|1",
              rateType: "BOOKABLE",
              net: 100,
              boardCode: "RO",
              boardName: "ROOM ONLY",
              paymentType: "AT_WEB",
              cancellationPolicies: [{ amount: 100, from: "2000-01-01T00:00:00Z" }],
            },
          ],
        },
      ],
    });
  });

  it("needs a session", async () => {
    expect((await call(valid, null)).status).toBe(401);
  });

  it("returns priced rooms with board and cancellation, and no net", async () => {
    const response = await call(valid);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.hotel).toEqual({ code: 195976, name: "The Boma Nairobi" });
    expect(body.rooms[0].rates[0]).toEqual({
      rateKey: "KEY|1",
      board: { code: "RO", name: "ROOM ONLY" },
      from: 1_725_000,
      cancellation: { freeCancellationUntil: null, policies: [{ from: "2000-01-01T00:00:00Z", amount: 1_725_000 }] },
    });
    expect(JSON.stringify(body)).not.toContain('"net"');
  });

  it("404s when the hotel has nothing for these dates", async () => {
    h.hotelRates.mockResolvedValue(null);
    expect((await call(valid)).status).toBe(404);
  });

  it("rejects unknown fields and bad stays", async () => {
    expect((await call({ ...valid, price: 1 })).status).toBe(400);
    expect((await call({ ...valid, hotelCode: "abc" })).status).toBe(400);
    expect((await call({ ...valid, checkOut: valid.checkIn })).status).toBe(400);
    expect(h.hotelRates).not.toHaveBeenCalled();
  });
});
