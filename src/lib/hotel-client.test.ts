import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hotelPost, parseStay, stayParams } from "./hotel-client";

describe("stay query string", () => {
  it("round-trips a stay with children", () => {
    const stay = { checkIn: "2027-03-01", checkOut: "2027-03-04", adults: 2, childAges: [6, 9] };
    expect(parseStay(stayParams(stay))).toEqual(stay);
  });

  it("leaves children out when there are none", () => {
    const params = stayParams({ checkIn: "2027-03-01", checkOut: "2027-03-04", adults: 1, childAges: [] });
    expect(params.has("children")).toBe(false);
  });

  it("rejects a stay a person mangled in the URL", () => {
    expect(parseStay(new URLSearchParams("checkIn=tomorrow&checkOut=2027-03-04"))).toBeNull();
    expect(parseStay(new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04&adults=99"))).toBeNull();
    expect(parseStay(new URLSearchParams(""))).toBeNull();
  });

  it("ignores bad child ages rather than failing the whole stay", () => {
    const stay = parseStay(new URLSearchParams("checkIn=2027-03-01&checkOut=2027-03-04&adults=2&children=6,x,40,9"));
    expect(stay?.childAges).toEqual([6, 9]);
  });
});

describe("hotelPost", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts a session and retries once after a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: "Session expired." }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ok: true })) // /session
      .mockResolvedValueOnce(Response.json({ hotels: [] }));

    const pending = hotelPost("/api/hotels/search", { a: 1 });
    await vi.advanceTimersByTimeAsync(2200);
    const result = await pending;

    expect(result).toEqual({ ok: true, data: { hotels: [] } });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/hotels/search", "/api/hotels/session", "/api/hotels/search"]);
  });

  it("gives up after one retry and reports the server's message", async () => {
    fetchMock.mockImplementation(async () => Response.json({ error: "Too many requests." }, { status: 429 }));
    const pending = hotelPost("/api/hotels/search", {});
    await vi.advanceTimersByTimeAsync(2200);
    expect(await pending).toEqual({ ok: false, status: 429, error: "Too many requests." });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a network failure without throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const result = await hotelPost("/api/hotels/search", {});
    expect(result.ok).toBe(false);
  });
});
