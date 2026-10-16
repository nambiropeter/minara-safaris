import { createHash } from "node:crypto";

/**
 * Hotelbeds APItude client. Server-only: the secret signs every request and must
 * never reach the browser. Returns null until both env vars exist, matching
 * `getStripe()`, so local work without credentials still builds.
 *
 * Defaults to the *test* host. Production is an explicit HOTELBEDS_BASE_URL and
 * only after the commercial agreement and certification.
 */
const DEFAULT_BASE_URL = "https://api.test.hotelbeds.com";
const REQUEST_TIMEOUT_MS = 15_000;

export type HotelbedsConfig = { apiKey: string; secret: string; baseUrl: string };

export function getHotelbeds(): HotelbedsConfig | null {
  const apiKey = process.env.HOTELBEDS_API_KEY;
  const secret = process.env.HOTELBEDS_SECRET;
  if (!apiKey || !secret) return null;
  return { apiKey, secret, baseUrl: process.env.HOTELBEDS_BASE_URL || DEFAULT_BASE_URL };
}

/** `X-Signature`: sha256(apiKey + secret + unix seconds), regenerated per request. */
export function signRequest(apiKey: string, secret: string, nowSeconds: number): string {
  return createHash("sha256").update(`${apiKey}${secret}${nowSeconds}`).digest("hex");
}

export class HotelbedsError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Hotelbeds ${status}: ${detail.slice(0, 300)}`);
  }
}

async function post<T>(config: HotelbedsConfig, path: string, body: unknown): Promise<T> {
  const signature = signRequest(config.apiKey, config.secret, Math.floor(Date.now() / 1000));
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Api-key": config.apiKey,
      "X-Signature": signature,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new HotelbedsError(response.status, await response.text().catch(() => ""));
  return (await response.json()) as T;
}

export type AvailabilityParams = {
  checkIn: string;
  checkOut: string;
  destination: string;
  /** Hotelbeds zone inside the destination, e.g. Diani is zone 9 of MBA. */
  zone?: number;
  adults: number;
  childAges: number[];
};

/** What we render from a result. `netFrom` stays server-side: margin is applied before anything leaves. */
export type HotelSummary = {
  code: number;
  name: string;
  category: string;
  destination: string;
  zone: string;
  currency: string;
  netFrom: number;
};

type RawHotel = {
  code: number;
  name: string;
  categoryName?: string;
  destinationName?: string;
  zoneName?: string;
  currency: string;
  minRate: string;
};

/**
 * Availability search. Callers must only reach this on an explicit user submit
 * with dates, and through the cache in `hotel-search.ts` — look-to-book is a
 * contractual ratio, not advice.
 */
export async function searchAvailability(
  config: HotelbedsConfig,
  params: AvailabilityParams,
): Promise<HotelSummary[]> {
  const paxes = params.childAges.map((age) => ({ type: "CH", age }));
  const raw = await post<{ hotels?: { hotels?: RawHotel[] } }>(config, "/hotel-api/1.0/hotels", {
    stay: { checkIn: params.checkIn, checkOut: params.checkOut },
    occupancies: [
      {
        rooms: 1,
        adults: params.adults,
        children: params.childAges.length,
        ...(paxes.length > 0 && { paxes }),
      },
    ],
    destination: { code: params.destination, ...(params.zone !== undefined && { zone: params.zone }) },
  });

  return (raw.hotels?.hotels ?? []).map((hotel) => ({
    code: hotel.code,
    name: hotel.name,
    category: hotel.categoryName ?? "",
    destination: hotel.destinationName ?? "",
    zone: hotel.zoneName ?? "",
    currency: hotel.currency,
    netFrom: Number(hotel.minRate),
  }));
}
