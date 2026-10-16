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

async function call<T>(config: HotelbedsConfig, method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const signature = signRequest(config.apiKey, config.secret, Math.floor(Date.now() / 1000));
  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      "Api-key": config.apiKey,
      "X-Signature": signature,
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new HotelbedsError(response.status, await response.text().catch(() => ""));
  return (await response.json()) as T;
}

const post = <T>(config: HotelbedsConfig, path: string, body: unknown) => call<T>(config, "POST", path, body);

/** Content API reads. Not look-to-book traffic, but cached by the caller all the same. */
export const get = <T>(config: HotelbedsConfig, path: string) => call<T>(config, "GET", path);

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

export type CheckedRate = {
  currency: string;
  /** The stay the rateKey is actually for. The rateKey encodes it, so this is the truth, not the request. */
  checkIn: string;
  checkOut: string;
  hotelCode: number;
  hotelName: string;
  roomName: string;
  adults: number;
  children: number;
  /** Check-in hours, deposits, minimum age: what the guest must be told before paying. */
  comments: string;
  /** True means the hotel wants card data from us. We never send any, so such a rate is not sellable. */
  paymentDataRequired: boolean;
  rate: HotelRate;
};

type RawCheckedRate = RawRate & { rateComments?: string; adults?: number; children?: number };

/**
 * Re-prices one rate with Hotelbeds right before we ask the customer to pay.
 * Required by the contract, not optional: rates move, and `RECHECK` rates are not
 * bookable until this confirms them. Expects exactly one room with one rate back.
 */
export async function checkRate(config: HotelbedsConfig, rateKey: string): Promise<CheckedRate> {
  const raw = await post<{
    hotel?: {
      code: number;
      name: string;
      currency: string;
      checkIn: string;
      checkOut: string;
      paymentDataRequired?: boolean;
      rooms?: { name: string; rates?: RawCheckedRate[] }[];
    };
  }>(config, "/hotel-api/1.0/checkrates", { rooms: [{ rateKey }] });

  const hotel = raw.hotel;
  const room = hotel?.rooms?.[0];
  const rate = room?.rates?.[0];
  if (!hotel || !room || !rate || hotel.rooms?.length !== 1 || room.rates?.length !== 1) {
    throw new HotelbedsError(502, "Unexpected checkrates response shape");
  }
  return {
    currency: hotel.currency,
    checkIn: hotel.checkIn,
    checkOut: hotel.checkOut,
    hotelCode: hotel.code,
    hotelName: hotel.name,
    roomName: room.name,
    adults: rate.adults ?? 0,
    children: rate.children ?? 0,
    comments: (rate.rateComments ?? "").trim(),
    paymentDataRequired: hotel.paymentDataRequired === true,
    rate: parseRate(rate),
  };
}

export type HotelBooking = {
  reference: string;
  clientReference: string;
  /** CONFIRMED, CANCELLED, ... */
  status: string;
  /** Net owed to Hotelbeds. After a cancellation this is the fee still payable (0 inside the free window). */
  totalNet: number;
  currency: string;
  /** The legal entity the guest's voucher must name ("payable through"). */
  supplierName: string;
  supplierVat: string;
};

type RawBooking = {
  reference: string;
  clientReference?: string;
  status: string;
  totalNet?: string | number;
  currency?: string;
  hotel?: { supplier?: { name?: string; vatNumber?: string } };
};

const parseBooking = (raw: RawBooking): HotelBooking => ({
  reference: raw.reference,
  clientReference: raw.clientReference ?? "",
  status: raw.status,
  totalNet: Number(raw.totalNet ?? 0),
  currency: raw.currency ?? "",
  supplierName: raw.hotel?.supplier?.name ?? "",
  supplierVat: raw.hotel?.supplier?.vatNumber ?? "",
});

/** References are digits and a dash. Anything else never goes into a URL. */
const safeReference = (reference: string) => {
  if (!/^[A-Za-z0-9-]{3,40}$/.test(reference)) throw new Error("Invalid Hotelbeds booking reference");
  return reference;
};

export async function getBooking(config: HotelbedsConfig, reference: string): Promise<HotelBooking> {
  const raw = await get<{ booking: RawBooking }>(
    config,
    `/hotel-api/1.0/bookings/${safeReference(reference)}?language=ENG`,
  );
  return parseBooking(raw.booking);
}

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * Looks a booking up by our own reference. This is how an ambiguous result is settled:
 * Hotelbeds can answer 500 (or time out) after it has already created the booking, so
 * "the call failed" must never be read as "no booking exists". The creation window is
 * a day either side so the Spanish/UTC date boundary can't hide it.
 */
export async function findBookingByClientReference(
  config: HotelbedsConfig,
  clientReference: string,
): Promise<HotelBooking | null> {
  const query = new URLSearchParams({
    start: isoDay(-1),
    end: isoDay(1),
    filterType: "CREATION",
    clientReference,
    from: "1",
    to: "10",
    language: "ENG",
  });
  const raw = await get<{ bookings?: { bookings?: RawBooking[] } }>(config, `/hotel-api/1.0/bookings?${query}`);
  const match = (raw.bookings?.bookings ?? []).find((b) => b.clientReference === clientReference);
  return match ? parseBooking(match) : null;
}

export type BookGuest = { type: "AD" | "CH"; name: string; surname: string; age?: number };

/**
 * Three outcomes, never a throw, so the caller can't confuse "unknown" with "failed":
 * - `booked`: Hotelbeds confirmed it.
 * - `rejected`: it definitely was not booked (a 4xx refusal, or a failure after which a
 *   lookup found nothing). Safe to refund.
 * - `unknown`: we can't tell. Do NOT refund and do NOT retry; a human checks Hotelbeds.
 */
export type BookOutcome =
  | { outcome: "booked"; booking: HotelBooking }
  | { outcome: "rejected"; reason: string }
  | { outcome: "unknown"; reason: string };

export async function bookRoom(
  config: HotelbedsConfig,
  args: { clientReference: string; rateKey: string; holder: { name: string; surname: string }; guests: BookGuest[]; remark?: string },
): Promise<BookOutcome> {
  const body = {
    holder: args.holder,
    rooms: [
      {
        rateKey: args.rateKey,
        paxes: args.guests.map((g) => ({
          roomId: 1,
          type: g.type,
          name: g.name,
          surname: g.surname,
          ...(g.age !== undefined && { age: g.age }),
        })),
      },
    ],
    clientReference: args.clientReference,
    ...(args.remark && { remark: args.remark }),
    tolerance: 2,
  };

  try {
    const raw = await post<{ booking: RawBooking }>(config, "/hotel-api/1.0/bookings", body);
    const booking = parseBooking(raw.booking);
    return booking.status === "CONFIRMED"
      ? { outcome: "booked", booking }
      : { outcome: "unknown", reason: `Hotelbeds answered with status ${booking.status}` };
  } catch (error) {
    // A 4xx is Hotelbeds saying no. Anything else (5xx, timeout, network) may have succeeded.
    if (error instanceof HotelbedsError && error.status >= 400 && error.status < 500) {
      return { outcome: "rejected", reason: error.message };
    }
    const reason = error instanceof Error ? error.message : String(error);
    try {
      const found = await findBookingByClientReference(config, args.clientReference);
      if (!found) return { outcome: "rejected", reason: `${reason} (no booking exists under ${args.clientReference})` };
      return found.status === "CONFIRMED"
        ? { outcome: "booked", booking: found }
        : { outcome: "unknown", reason: `${reason} (a booking exists with status ${found.status})` };
    } catch (lookupError) {
      const detail = lookupError instanceof Error ? lookupError.message : String(lookupError);
      return { outcome: "unknown", reason: `${reason}; checking for the booking also failed: ${detail}` };
    }
  }
}

export type CancelOutcome =
  | { outcome: "cancelled"; feeNet: number }
  | { outcome: "failed"; reason: string }
  | { outcome: "unknown"; reason: string };

/**
 * Cancels, and verifies. The sandbox answered a real cancellation with a 500 and had in
 * fact cancelled, so a failed DELETE is settled by reading the booking back.
 */
export async function cancelBooking(config: HotelbedsConfig, reference: string): Promise<CancelOutcome> {
  let failure = "";
  try {
    const raw = await call<{ booking: RawBooking }>(
      config,
      "DELETE",
      `/hotel-api/1.0/bookings/${safeReference(reference)}?cancellationFlag=CANCELLATION&language=ENG`,
    );
    const booking = parseBooking(raw.booking);
    if (booking.status === "CANCELLED") return { outcome: "cancelled", feeNet: booking.totalNet };
    failure = `Hotelbeds answered with status ${booking.status}`;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  try {
    const now = await getBooking(config, reference);
    return now.status === "CANCELLED"
      ? { outcome: "cancelled", feeNet: now.totalNet }
      : { outcome: "failed", reason: `${failure} (booking is still ${now.status})` };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { outcome: "unknown", reason: `${failure}; reading the booking back also failed: ${detail}` };
  }
}
