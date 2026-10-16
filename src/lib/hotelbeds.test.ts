import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRate, getHotelbeds, getHotelRates, HotelbedsError, searchAvailability, signRequest } from "./hotelbeds";

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

const rawRate = (over: Record<string, unknown> = {}) => ({
  rateKey: "20270301|20270304|W|1|7|DBL.ST|ID_B2B_26|RO||1~2~0||N@AB|CD==",
  rateType: "BOOKABLE",
  net: "100.00",
  boardCode: "RO",
  boardName: "ROOM ONLY",
  paymentType: "AT_WEB",
  packaging: false,
  cancellationPolicies: [{ amount: "100.00", from: "2027-02-20T23:59:00+03:00" }],
  ...over,
});

describe("getHotelRates", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks for one hotel and keeps only sellable rates, earliest cancellation first", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        hotels: {
          hotels: [
            {
              code: 7,
              name: "Hotel A",
              currency: "EUR",
              rooms: [
                {
                  code: "DBL",
                  name: "Double",
                  rates: [
                    rawRate({
                      cancellationPolicies: [
                        { amount: "100.00", from: "2027-02-27T23:59:00+03:00" },
                        { amount: "50.00", from: "2027-02-20T23:59:00+03:00" },
                      ],
                    }),
                    rawRate({ packaging: true }),
                    rawRate({ paymentType: "AT_HOTEL" }),
                  ],
                },
                { code: "SUI", name: "Suite", rates: [rawRate({ packaging: true })] },
              ],
            },
          ],
        },
      }),
    );

    const result = await getHotelRates(config, 7, { checkIn: "2027-03-01", checkOut: "2027-03-04", adults: 2, childAges: [] });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).hotels).toEqual({ hotel: [7] });
    expect(result?.rooms).toHaveLength(1); // the suite had only packaging rates
    expect(result?.rooms[0].rates).toHaveLength(1);
    expect(result?.rooms[0].rates[0].cancellationPolicies.map((p) => p.amount)).toEqual([50, 100]);
    expect(result?.rooms[0].rates[0].net).toBe(100);
  });

  it("is null when the hotel has no availability", async () => {
    fetchMock.mockImplementation(async () => Response.json({}));
    expect(await getHotelRates(config, 7, { checkIn: "2027-03-01", checkOut: "2027-03-04", adults: 2, childAges: [] })).toBeNull();
  });
});

describe("checkRate", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the rateKey byte for byte and parses the one rate back", async () => {
    const rateKey = "A|B+C/=|~x y";
    fetchMock.mockImplementation(async () =>
      Response.json({ hotel: { currency: "EUR", rooms: [{ rates: [rawRate({ rateKey, net: "110.50" })] }] } }),
    );

    const checked = await checkRate(config, rateKey);

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test.hotelbeds.com/hotel-api/1.0/checkrates");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ rooms: [{ rateKey }] });
    expect(checked.currency).toBe("EUR");
    expect(checked.rate.net).toBe(110.5);
    expect(checked.rate.rateKey).toBe(rateKey);
  });

  it("refuses a response that is not exactly one room with one rate", async () => {
    fetchMock.mockImplementation(async () => Response.json({ hotel: { currency: "EUR", rooms: [] } }));
    await expect(checkRate(config, "k")).rejects.toBeInstanceOf(HotelbedsError);
    fetchMock.mockImplementation(async () =>
      Response.json({ hotel: { currency: "EUR", rooms: [{ rates: [rawRate(), rawRate()] }] } }),
    );
    await expect(checkRate(config, "k")).rejects.toBeInstanceOf(HotelbedsError);
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

  it("sends the zone only when one is given", async () => {
    // A fresh Response per call: a body can only be read once.
    fetchMock.mockImplementation(async () => Response.json({}));
    await searchAvailability(config, { ...params, destination: "MBA", zone: 9 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).destination).toEqual({ code: "MBA", zone: 9 });
    await searchAvailability(config, params);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).destination).toEqual({ code: "NBO" });
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
