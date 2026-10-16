import { createHash } from "node:crypto";

import { searchAvailability, type AvailabilityParams, type HotelbedsConfig, type HotelSummary } from "./hotelbeds";

/**
 * Identical searches are served from cache, so look-to-book only counts distinct
 * ones. Hotelbeds does not cache for us: this is the protection.
 *
 * ponytail: in-memory per process, so it does NOT protect the ratio across
 * serverless instances. Fine against the test host; before a production key
 * exists, move this (and the call counters) to Postgres. Tracked as step 3.
 */
const TTL_MS = 20 * 60 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { at: number; hotels: HotelSummary[] }>();

export function cacheKey(params: AvailabilityParams): string {
  const normalised = { ...params, childAges: [...params.childAges].sort((a, b) => a - b) };
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}

export async function searchHotels(
  config: HotelbedsConfig,
  params: AvailabilityParams,
  now = Date.now(),
): Promise<HotelSummary[]> {
  const key = cacheKey(params);
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.hotels;

  const hotels = await searchAvailability(config, params);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, hotels });
  return hotels;
}
