import { createHash } from "node:crypto";

import { readCache, writeCache } from "./hotel-cache";
import { recordHotelCall } from "./hotel-calls";
import {
  getHotelRates,
  searchAvailability,
  type AvailabilityParams,
  type HotelbedsConfig,
  type HotelRates,
  type HotelSummary,
} from "./hotelbeds";

/**
 * Identical lookups are served from the shared Postgres cache, so look-to-book only
 * counts distinct ones. Hotelbeds does not cache for us: this is the protection, and
 * it is shared across instances because the ratio is the account's, not an instance's.
 * Every lookup that does reach Hotelbeds is recorded first (`hotel-calls`).
 */
const TTL_MS = 20 * 60 * 1000;

export function cacheKey(params: object): string {
  const normalised =
    "childAges" in params && Array.isArray(params.childAges)
      ? { ...params, childAges: [...params.childAges].sort((a, b) => a - b) }
      : params;
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}

async function cached<T>(key: string, now: number, load: () => Promise<T>): Promise<T> {
  const hit = await readCache<T>(key, now);
  if (hit) return hit.value;

  await recordHotelCall("availability");
  const value = await load();
  await writeCache(key, value, TTL_MS, now);
  return value;
}

export function searchHotels(
  config: HotelbedsConfig,
  params: AvailabilityParams,
  now = Date.now(),
): Promise<HotelSummary[]> {
  return cached(`search:${cacheKey(params)}`, now, () => searchAvailability(config, params));
}

export type StayParams = Pick<AvailabilityParams, "checkIn" | "checkOut" | "adults" | "childAges">;

export function hotelRates(
  config: HotelbedsConfig,
  hotelCode: number,
  params: StayParams,
  now = Date.now(),
): Promise<HotelRates | null> {
  return cached(`rates:${hotelCode}:${cacheKey(params)}`, now, () => getHotelRates(config, hotelCode, params));
}
