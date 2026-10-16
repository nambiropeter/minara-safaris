import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  record: vi.fn(),
  searchAvailability: vi.fn(),
  getHotelRates: vi.fn(),
}));

vi.mock("./hotel-cache", () => ({ readCache: h.readCache, writeCache: h.writeCache }));
vi.mock("./hotel-calls", () => ({ recordHotelCall: h.record }));
vi.mock("./hotelbeds", () => ({ searchAvailability: h.searchAvailability, getHotelRates: h.getHotelRates }));

import { cacheKey, hotelRates, searchHotels } from "./hotel-search";

const config = { apiKey: "k", secret: "s", baseUrl: "https://x" };
const params = { checkIn: "2027-03-01", checkOut: "2027-03-04", destination: "NAI", adults: 2, childAges: [] };
const NOW = 1_700_000_000_000;

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
});

describe("searchHotels", () => {
  it("on a miss: counts the supplier call, loads, and caches for twenty minutes", async () => {
    h.readCache.mockResolvedValue(undefined);
    h.searchAvailability.mockResolvedValue([{ code: 1 }]);

    expect(await searchHotels(config, params, NOW)).toEqual([{ code: 1 }]);

    expect(h.record).toHaveBeenCalledWith("availability");
    expect(h.searchAvailability).toHaveBeenCalledTimes(1);
    expect(h.writeCache).toHaveBeenCalledWith(expect.stringMatching(/^search:/), [{ code: 1 }], 20 * 60 * 1000, NOW);
  });

  it("on a hit: serves the cache and neither counts nor calls Hotelbeds", async () => {
    h.readCache.mockResolvedValue({ value: [{ code: 2 }] });

    expect(await searchHotels(config, params, NOW)).toEqual([{ code: 2 }]);

    expect(h.record).not.toHaveBeenCalled();
    expect(h.searchAvailability).not.toHaveBeenCalled();
    expect(h.writeCache).not.toHaveBeenCalled();
  });

  it("records the call before making it, so a failed request still counts", async () => {
    h.readCache.mockResolvedValue(undefined);
    h.searchAvailability.mockRejectedValue(new Error("boom"));

    await expect(searchHotels(config, params, NOW)).rejects.toThrow("boom");

    expect(h.record).toHaveBeenCalledTimes(1);
    expect(h.writeCache).not.toHaveBeenCalled(); // a failure is never cached
  });
});

describe("hotelRates", () => {
  const stay = { checkIn: "2027-03-01", checkOut: "2027-03-04", adults: 2, childAges: [] };

  it("caches a hotel with no availability as a real answer", async () => {
    h.readCache.mockResolvedValue({ value: null });
    expect(await hotelRates(config, 7, stay, NOW)).toBeNull();
    expect(h.getHotelRates).not.toHaveBeenCalled();
  });

  it("keys on the hotel as well as the stay", async () => {
    h.readCache.mockResolvedValue(undefined);
    h.getHotelRates.mockResolvedValue(null);
    await hotelRates(config, 7, stay, NOW);
    await hotelRates(config, 8, stay, NOW);
    const [a, b] = h.writeCache.mock.calls.map((c) => c[0]);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^rates:7:/);
  });
});

describe("cacheKey", () => {
  it("is the same whatever order the children are listed in", () => {
    expect(cacheKey({ ...params, childAges: [9, 4] })).toBe(cacheKey({ ...params, childAges: [4, 9] }));
  });

  it("differs when the stay differs", () => {
    expect(cacheKey(params)).not.toBe(cacheKey({ ...params, adults: 3 }));
    expect(cacheKey(params)).not.toBe(cacheKey({ ...params, zone: 9 }));
  });
});
