import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bookRoom,
  cancelBooking,
  checkRate,
  findBookingByClientReference,
  getBooking,
  getHotelbeds,
  getHotelRates,
  HotelbedsError,
  searchAvailability,
  signRequest,
} from "./hotelbeds";

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


const rawBooking = (over: Record<string, unknown> = {}) => ({
  reference: "286-264500",
  clientReference: "MS-2026-ABC",
  status: "CONFIRMED",
  totalNet: "338.28",
  currency: "EUR",
  hotel: { supplier: { name: "HOTELBEDS SPAIN S.L.U.", vatNumber: "ESB28916765" } },
  ...over,
});

const bookArgs = {
  clientReference: "MS-2026-ABC",
  rateKey: "A|B+C/=|~x",
  holder: { name: "Amina", surname: "Otieno" },
  guests: [
    { type: "AD" as const, name: "Amina", surname: "Otieno" },
    { type: "CH" as const, name: "Zuri", surname: "Otieno", age: 7 },
  ],
};

describe("bookRoom", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const respond = (...steps: (Response | Error)[]) => {
    for (const step of steps) {
      fetchMock.mockImplementationOnce(async () => {
        if (step instanceof Error) throw step;
        return step.clone();
      });
    }
  };

  it("sends holder, every guest with their room and age, our reference and the untouched rateKey", async () => {
    respond(Response.json({ booking: rawBooking() }));

    const result = await bookRoom(config, bookArgs);

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test.hotelbeds.com/hotel-api/1.0/bookings");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      holder: { name: "Amina", surname: "Otieno" },
      clientReference: "MS-2026-ABC",
      rooms: [
        {
          rateKey: "A|B+C/=|~x",
          paxes: [
            { roomId: 1, type: "AD", name: "Amina", surname: "Otieno" },
            { roomId: 1, type: "CH", name: "Zuri", surname: "Otieno", age: 7 },
          ],
        },
      ],
    });
    expect(result).toEqual({
      outcome: "booked",
      booking: {
        reference: "286-264500",
        clientReference: "MS-2026-ABC",
        status: "CONFIRMED",
        totalNet: 338.28,
        currency: "EUR",
        supplierName: "HOTELBEDS SPAIN S.L.U.",
        supplierVat: "ESB28916765",
      },
    });
  });

  it("treats a 4xx as a definite refusal, without going looking for a booking", async () => {
    respond(new Response('{"error":{"code":"PRODUCT_NOT_AVAILABLE"}}', { status: 409 }));

    const result = await bookRoom(config, bookArgs);

    expect(result.outcome).toBe("rejected");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("after a 500, finds the booking Hotelbeds actually made, and calls it booked", async () => {
    respond(
      new Response("boom", { status: 500 }),
      Response.json({ bookings: { bookings: [rawBooking()] } }),
    );

    const result = await bookRoom(config, bookArgs);

    expect(result.outcome).toBe("booked");
    expect(fetchMock.mock.calls[1][0]).toContain("clientReference=MS-2026-ABC");
  });

  it("after a timeout, finds nothing, and so can safely say it was not booked", async () => {
    respond(new DOMException("timed out", "TimeoutError"), Response.json({ bookings: { bookings: [] } }));
    expect((await bookRoom(config, bookArgs)).outcome).toBe("rejected");
  });

  it("will not call it rejected when the lookup itself fails: that is unknown, and must not be refunded", async () => {
    respond(new Response("boom", { status: 500 }), new Response("still down", { status: 503 }));
    expect((await bookRoom(config, bookArgs)).outcome).toBe("unknown");
  });

  it("is unknown, not booked, when Hotelbeds answers with anything but CONFIRMED", async () => {
    respond(Response.json({ booking: rawBooking({ status: "PRECONFIRMED" }) }));
    expect((await bookRoom(config, bookArgs)).outcome).toBe("unknown");
  });

  it("ignores a lookup match that is some other booking's reference", async () => {
    respond(
      new Response("boom", { status: 500 }),
      Response.json({ bookings: { bookings: [rawBooking({ clientReference: "MS-2026-OTHER" })] } }),
    );
    expect((await bookRoom(config, bookArgs)).outcome).toBe("rejected");
  });
});

describe("cancelBooking", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  const respond = (...steps: Response[]) => steps.forEach((s) => fetchMock.mockImplementationOnce(async () => s.clone()));

  it("cancels, and reports the fee still owed (nothing, inside the free window)", async () => {
    respond(Response.json({ booking: rawBooking({ status: "CANCELLED", totalNet: "0.00" }) }));

    const result = await cancelBooking(config, "286-264500");

    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls[0][0]).toContain("/bookings/286-264500?cancellationFlag=CANCELLATION");
    expect(result).toEqual({ outcome: "cancelled", feeNet: 0 });
  });

  it("reads the booking back after an error, and accepts it as cancelled (the sandbox does this)", async () => {
    respond(
      new Response('{"error":{"code":"SYSTEM_ERROR"}}', { status: 500 }),
      Response.json({ booking: rawBooking({ status: "CANCELLED", totalNet: "0.00" }) }),
    );
    expect(await cancelBooking(config, "286-264500")).toEqual({ outcome: "cancelled", feeNet: 0 });
  });

  it("says failed when the booking is still live after the error", async () => {
    respond(new Response("boom", { status: 500 }), Response.json({ booking: rawBooking() }));
    const result = await cancelBooking(config, "286-264500");
    expect(result.outcome).toBe("failed");
  });

  it("says unknown when it can neither cancel nor read the booking back", async () => {
    respond(new Response("boom", { status: 500 }), new Response("boom", { status: 500 }));
    expect((await cancelBooking(config, "286-264500")).outcome).toBe("unknown");
  });

  it("never puts an odd reference into a URL", async () => {
    await expect(getBooking(config, "../../etc")).rejects.toThrow("Invalid Hotelbeds booking reference");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("findBookingByClientReference", () => {
  it("asks for our reference over a window a day either side of today", async () => {
    const fetchMock = vi.fn(async () => Response.json({ bookings: { bookings: [] } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findBookingByClientReference(config, "MS-2026-ABC")).toBeNull();
    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("clientReference")).toBe("MS-2026-ABC");
    expect(url.searchParams.get("filterType")).toBe("CREATION");
    vi.unstubAllGlobals();
  });
});

describe("checkRate details", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns what the guest must be told and what the booking needs", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        Response.json({
          hotel: {
            code: 195976,
            name: "The Boma Nairobi",
            currency: "EUR",
            checkIn: "2027-03-01",
            checkOut: "2027-03-04",
            paymentDataRequired: false,
            rooms: [{ name: "Superior room", rates: [rawRate({ adults: 2, children: 1, rateComments: " Deposit on arrival. Minimum check-in age 18. " })] }],
          },
        }),
    );

    const checked = await checkRate(config, "k");

    expect(checked).toMatchObject({
      checkIn: "2027-03-01",
      checkOut: "2027-03-04",
      hotelCode: 195976,
      hotelName: "The Boma Nairobi",
      roomName: "Superior room",
      adults: 2,
      children: 1,
      comments: "Deposit on arrival. Minimum check-in age 18.",
      paymentDataRequired: false,
    });
  });

  it("flags a rate that wants card data, which we never send", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        Response.json({ hotel: { code: 1, name: "H", currency: "EUR", paymentDataRequired: true, rooms: [{ name: "R", rates: [rawRate()] }] } }),
    );
    expect((await checkRate(config, "k")).paymentDataRequired).toBe(true);
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
