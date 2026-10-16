import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ searchAvailability: vi.fn(), getHotelRates: vi.fn() }));
vi.mock("./hotelbeds", () => ({ searchAvailability: h.searchAvailability, getHotelRates: h.getHotelRates }));

import { cacheKey, hotelRates, searchHotels } from "./hotel-search";

const config = { apiKey: "k", secret: "s", baseUrl: "https://x" };
// A distinct stay per test: the cache is module-level, so tests must not share keys.
let n = 0;
const stay = () => ({ checkIn: `2027-03-${String(++n).padStart(2, "0")}`, checkOut: "2027-04-30", adults: 2, childAges: [] });
const NOW = 1_700_000_000_000;
const TTL = 20 * 60 * 1000;

beforeEach(() => {
  h.searchAvailability.mockReset();
  h.getHotelRates.mockReset();
});

describe("searchHotels", () => {
  it("serves an identical search from cache, so Hotelbeds is asked once", async () => {
    h.searchAvailability.mockResolvedValue([{ code: 1 }]);
    const params = { ...stay(), destination: "NAI" };

    expect(await searchHotels(config, params, NOW)).toEqual([{ code: 1 }]);
    expect(await searchHotels(config, params, NOW + 1000)).toEqual([{ code: 1 }]);

    expect(h.searchAvailability).toHaveBeenCalledTimes(1);
  });

  it("asks again once the twenty minutes are up", async () => {
    h.searchAvailability.mockResolvedValue([]);
    const params = { ...stay(), destination: "NAI" };

    await searchHotels(config, params, NOW);
    await searchHotels(config, params, NOW + TTL + 1);

    expect(h.searchAvailability).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure", async () => {
    h.searchAvailability.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([{ code: 2 }]);
    const params = { ...stay(), destination: "NAI" };

    await expect(searchHotels(config, params, NOW)).rejects.toThrow("boom");
    expect(await searchHotels(config, params, NOW)).toEqual([{ code: 2 }]);
  });
});

describe("hotelRates", () => {
  it("remembers a hotel with no availability instead of asking again", async () => {
    h.getHotelRates.mockResolvedValue(null);
    const params = stay();

    expect(await hotelRates(config, 7, params, NOW)).toBeNull();
    expect(await hotelRates(config, 7, params, NOW)).toBeNull();

    expect(h.getHotelRates).toHaveBeenCalledTimes(1);
  });

  it("keeps one hotel's rates apart from another's for the same stay", async () => {
    h.getHotelRates.mockResolvedValueOnce({ code: 7 }).mockResolvedValueOnce({ code: 8 });
    const params = stay();

    expect(await hotelRates(config, 7, params, NOW)).toEqual({ code: 7 });
    expect(await hotelRates(config, 8, params, NOW)).toEqual({ code: 8 });
  });
});

describe("cacheKey", () => {
  const base = { ...stay(), destination: "NAI" };

  it("is the same whatever order the children are listed in", () => {
    expect(cacheKey({ ...base, childAges: [9, 4] })).toBe(cacheKey({ ...base, childAges: [4, 9] }));
  });

  it("differs when the search differs", () => {
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, adults: 3 }));
    expect(cacheKey(base)).not.toBe(cacheKey({ ...base, zone: 9 }));
  });
});
