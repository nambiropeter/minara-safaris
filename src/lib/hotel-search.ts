import { createHash } from "node:crypto";

import {
  getHotelRates,
  searchAvailability,
  type AvailabilityParams,
  type HotelbedsConfig,
  type HotelRates,
  type HotelSummary,
} from "./hotelbeds";

/**
 * Identical lookups are served from cache, so look-to-book only counts distinct
 * ones. Hotelbeds does not cache for us: this is the protection.
 *
 * ponytail: in-memory per process, so on serverless it only dedupes within an instance.
 * Deliberate at this volume. If a production key's look-to-book ever needs it, move this
 * to Postgres and add request counters (docs/hotelbeds_caveats.md).
 */
const TTL_MS = 20 * 60 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { at: number; value: unknown }>();

export function cacheKey(params: object): string {
  const normalised =
    "childAges" in params && Array.isArray(params.childAges)
      ? { ...params, childAges: [...params.childAges].sort((a, b) => a - b) }
      : params;
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}

async function cached<T>(key: string, now: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value as T;

  const value = await load();
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, value });
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
