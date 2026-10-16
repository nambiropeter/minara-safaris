import type { Cancellation } from "./hotel-format";

/**
 * Browser side of /api/hotels/*. The routes need the anonymous session cookie and
 * refuse a session younger than two seconds, so a first call can legitimately get a
 * 401 (no cookie yet) or a 429 (cookie too new). Both are retried once, after the
 * cookie exists and has aged; anything else is the caller's to show.
 */
const MIN_SESSION_AGE_MS = 2100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Warm the session as soon as a hotel form mounts, so a search a few seconds later never waits. */
export async function ensureHotelSession(): Promise<void> {
  await fetch("/api/hotels/session", { method: "POST" }).catch(() => {});
}

export type HotelApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function hotelPost<T>(path: string, body: unknown): Promise<HotelApiResult<T>> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, status: 0, error: "Could not reach the server. Check your connection and try again." };
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, data: data as T };

    if (attempt === 0 && response.status === 401) {
      await ensureHotelSession();
      await sleep(MIN_SESSION_AGE_MS);
      continue;
    }
    if (attempt === 0 && response.status === 429) {
      await sleep(MIN_SESSION_AGE_MS);
      continue;
    }
    return { ok: false, status: response.status, error: (data as { error?: string }).error ?? "Something went wrong. Please try again." };
  }
}

export type HotelStay = {
  checkIn: string;
  checkOut: string;
  adults: number;
  childAges: number[];
};

export type SearchResponse = {
  nights: number;
  currency: "KES" | "USD";
  hotels: { code: number; name: string; category: string; destination: string; zone: string; image: string | null; from: number }[];
};

export type RatesResponse = {
  nights: number;
  currency: "KES" | "USD";
  hotel: { code: number; name: string };
  rooms: {
    code: string;
    name: string;
    rates: { rateKey: string; board: { code: string; name: string }; from: number; cancellation: Cancellation }[];
  }[];
};

export type CheckrateResponse = {
  rateKey: string;
  board: { code: string; name: string };
  from: number;
  previousFrom: number;
  priceChanged: boolean;
  cancellation: Cancellation;
};

/** Query-string form of a stay, shared by the form, results and detail links. */
export function stayParams(stay: HotelStay): URLSearchParams {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: String(stay.adults),
  });
  if (stay.childAges.length > 0) params.set("children", stay.childAges.join(","));
  return params;
}

/** The inverse, tolerant of anything a person can type into a URL. Null if the stay isn't usable. */
export function parseStay(params: URLSearchParams): HotelStay | null {
  const checkIn = params.get("checkIn");
  const checkOut = params.get("checkOut");
  const adults = Number(params.get("adults") ?? "2");
  const isDate = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  if (!isDate(checkIn) || !isDate(checkOut) || !Number.isInteger(adults) || adults < 1 || adults > 8) return null;
  const childAges = (params.get("children") ?? "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((age) => Number.isInteger(age) && age >= 0 && age <= 17)
    .slice(0, 6);
  return { checkIn, checkOut, adults, childAges };
}
