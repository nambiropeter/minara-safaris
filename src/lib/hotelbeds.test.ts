import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHotelbeds, HotelbedsError, searchAvailability, signRequest } from "./hotelbeds";

const config = { apiKey: "key123", secret: "shh", baseUrl: "https://api.test.hotelbeds.com" };
const params = { checkIn: "2027-03-01", checkOut: "2027-03-04", destination: "NBO", adults: 2, childAges: [] };

describe("signRequest", () => {
  it("is sha256(apiKey + secret + unix seconds)", () => {
    const expected = createHash("sha256").update("key123shh1700000000").digest("hex");
    expect(signRequest("key123", "shh", 1_700_000_000)).toBe(expected);
  });
});

describe("getHotelbeds", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is null until both key and secret exist", () => {
    vi.stubEnv("HOTELBEDS_API_KEY", "k");
    vi.stubEnv("HOTELBEDS_SECRET", "");
    expect(getHotelbeds()).toBeNull();
  });

  it("defaults to the test host", () => {
    vi.stubEnv("HOTELBEDS_API_KEY", "k");
    vi.stubEnv("HOTELBEDS_SECRET", "s");
    vi.stubEnv("HOTELBEDS_BASE_URL", "");
    expect(getHotelbeds()?.baseUrl).toBe("https://api.test.hotelbeds.com");
  });
});

describe("searchAvailability", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("signs the request, sends the stay and occupancy, and maps hotels", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        hotels: {
          hotels: [
            { code: 7, name: "Hotel A", categoryName: "4 STARS", destinationName: "Nairobi", zoneName: "Westlands", currency: "EUR", minRate: "120.50" },
          ],
        },
      }),
    );

    const hotels = await searchAvailability(config, { ...params, childAges: [6] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test.hotelbeds.com/hotel-api/1.0/hotels");
    expect(init.headers["Api-key"]).toBe("key123");
    expect(init.headers["X-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(init.body)).toEqual({
      stay: { checkIn: "2027-03-01", checkOut: "2027-03-04" },
      occupancies: [{ rooms: 1, adults: 2, children: 1, paxes: [{ type: "CH", age: 6 }] }],
      destination: { code: "NBO" },
    });
    expect(hotels).toEqual([
      { code: 7, name: "Hotel A", category: "4 STARS", destination: "Nairobi", zone: "Westlands", currency: "EUR", netFrom: 120.5 },
    ]);
  });

  it("omits paxes when there are no children", async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    await searchAvailability(config, params);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).occupancies[0]).toEqual({ rooms: 1, adults: 2, children: 0 });
  });

  it("returns an empty list when Hotelbeds has no hotels", async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    expect(await searchAvailability(config, params)).toEqual([]);
  });

  it("throws a HotelbedsError without leaking the secret", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));
    const error = await searchAvailability(config, params).catch((e) => e);
    expect(error).toBeInstanceOf(HotelbedsError);
    expect(error.status).toBe(401);
    expect(error.message).not.toContain("shh");
  });
});
