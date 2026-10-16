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

export type CancellationPolicy = { amount: number; from: string };

export type HotelRate = {
  /** Opaque. Passed back to Hotelbeds byte for byte: never parse, trim or re-encode it. */
  rateKey: string;
  rateType: string;
  net: number;
  boardCode: string;
  boardName: string;
  paymentType: string;
  /** Earliest first. A fee applies from each `from`; before the first one cancelling is free. */
  cancellationPolicies: CancellationPolicy[];
};

export type HotelRoom = { code: string; name: string; rates: HotelRate[] };

type RawRate = {
  rateKey: string;
  rateType: string;
  net: string;
  boardCode: string;
  boardName: string;
  paymentType: string;
  packaging?: boolean;
  cancellationPolicies?: { amount: string; from: string }[];
};

function parseRate(raw: RawRate): HotelRate {
  return {
    rateKey: raw.rateKey,
    rateType: raw.rateType,
    net: Number(raw.net),
    boardCode: raw.boardCode,
    boardName: raw.boardName,
    paymentType: raw.paymentType,
    cancellationPolicies: (raw.cancellationPolicies ?? [])
      .map((p) => ({ amount: Number(p.amount), from: p.from }))
      .sort((a, b) => Date.parse(a.from) - Date.parse(b.from)),
  };
}

export type HotelRates = { code: number; name: string; currency: string; rooms: HotelRoom[] };

/**
 * Rooms and rates for one hotel, limited to what we can actually sell.
 * - Packaging rates are dropped: Hotelbeds marks them as sellable only inside a
 *   package, and the request-level `filter.packaging` is accepted but ignored
 *   (verified on the test host), so we filter here.
 *   ponytail: conservative reading of the packaging flag; confirm at certification.
 * - Only `AT_WEB` rates: we collect payment through Stripe, so a pay-at-hotel
 *   rate would skip our checkout entirely.
 */
export async function getHotelRates(
  config: HotelbedsConfig,
  hotelCode: number,
  params: Pick<AvailabilityParams, "checkIn" | "checkOut" | "adults" | "childAges">,
): Promise<HotelRates | null> {
  const paxes = params.childAges.map((age) => ({ type: "CH", age }));
  const raw = await post<{
    hotels?: {
      hotels?: { code: number; name: string; currency: string; rooms?: { code: string; name: string; rates: RawRate[] }[] }[];
    };
  }>(config, "/hotel-api/1.0/hotels", {
    stay: { checkIn: params.checkIn, checkOut: params.checkOut },
    occupancies: [
      {
        rooms: 1,
        adults: params.adults,
        children: params.childAges.length,
        ...(paxes.length > 0 && { paxes }),
      },
    ],
    hotels: { hotel: [hotelCode] },
  });

  const hotel = raw.hotels?.hotels?.[0];
  if (!hotel) return null;
  const rooms = (hotel.rooms ?? [])
    .map((room) => ({
      code: room.code,
      name: room.name,
      rates: room.rates.filter((rate) => !rate.packaging && rate.paymentType === "AT_WEB").map(parseRate),
    }))
    .filter((room) => room.rates.length > 0);
  return { code: hotel.code, name: hotel.name, currency: hotel.currency, rooms };
}

export type CheckedRate = { currency: string; rate: HotelRate };

/**
 * Re-prices one rate with Hotelbeds right before we ask the customer to pay.
 * Required by the contract, not optional: rates move, and `RECHECK` rates are not
 * bookable until this confirms them. Expects exactly one room with one rate back.
 */
export async function checkRate(config: HotelbedsConfig, rateKey: string): Promise<CheckedRate> {
  const raw = await post<{
    hotel?: { currency: string; rooms?: { rates?: RawRate[] }[] };
  }>(config, "/hotel-api/1.0/checkrates", { rooms: [{ rateKey }] });

  const rate = raw.hotel?.rooms?.[0]?.rates?.[0];
  if (!raw.hotel || !rate || (raw.hotel.rooms?.length ?? 0) !== 1 || (raw.hotel.rooms?.[0]?.rates?.length ?? 0) !== 1) {
    throw new HotelbedsError(502, "Unexpected checkrates response shape");
  }
  return { currency: raw.hotel.currency, rate: parseRate(rate) };
}
