import { get, type HotelbedsConfig } from "./hotelbeds";

/**
 * Hotel content (photos, description, address) from the Hotelbeds Content API,
 * fetched on demand and kept for a day. Not a bulk ingest: we only ever hold what
 * a visitor has actually looked at.
 *
 * ponytail: in-memory per process, like the search cache. Content changes rarely,
 * so the cost of a cold instance is one extra call, not a ratio problem.
 */
const PHOTO_HOST = "https://photos.hotelbeds.com/giata/bigger/";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 1000;

export const photoUrl = (path: string) => `${PHOTO_HOST}${path}`;

type RawImage = { path: string; visualOrder?: number; order?: number };

/** Hotelbeds' own display order, falling back to the listed one. */
const orderedPaths = (images: RawImage[] = []) =>
  [...images].sort((a, b) => (a.visualOrder ?? a.order ?? 0) - (b.visualOrder ?? b.order ?? 0)).map((i) => i.path);

export type HotelContent = {
  code: number;
  name: string;
  description: string;
  address: string;
  city: string;
  zone: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  images: string[];
};

const imageCache = new Map<number, { at: number; first: string | null }>();
const detailCache = new Map<number, { at: number; content: HotelContent | null }>();

function remember<K, V extends { at: number }>(cache: Map<K, V>, key: K, value: V) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as K);
  cache.set(key, value);
}

/**
 * One cover photo per hotel for a results list, in a single bulk call for the
 * hotels we don't already know. Never throws: a list without thumbnails is still a
 * list, and this must not take the search down with it.
 */
export async function getCoverImages(
  config: HotelbedsConfig,
  codes: number[],
  now = Date.now(),
): Promise<Map<number, string>> {
  const covers = new Map<number, string>();
  const missing: number[] = [];
  for (const code of codes) {
    const hit = imageCache.get(code);
    if (hit && now - hit.at < TTL_MS) {
      if (hit.first) covers.set(code, photoUrl(hit.first));
    } else {
      missing.push(code);
    }
  }

  // The API pages at 100; a results list never needs more than one page.
  const batch = missing.slice(0, 100);
  if (batch.length > 0) {
    try {
      const raw = await get<{ hotels?: { code: number; images?: RawImage[] }[] }>(
        config,
        `/hotel-content-api/1.0/hotels?codes=${batch.join(",")}&fields=code,images&language=ENG&from=1&to=100`,
      );
      for (const hotel of raw.hotels ?? []) {
        const first = orderedPaths(hotel.images)[0] ?? null;
        remember(imageCache, hotel.code, { at: now, first });
        if (first) covers.set(hotel.code, photoUrl(first));
      }
    } catch (error) {
      console.error("hotelbeds cover images failed", error);
    }
  }
  return covers;
}

type RawDetails = {
  hotel?: {
    code: number;
    name?: { content?: string };
    description?: { content?: string };
    address?: { content?: string };
    city?: { content?: string };
    zone?: { name?: string };
    category?: { description?: { content?: string } };
    coordinates?: { latitude?: number; longitude?: number };
    images?: RawImage[];
  };
};

/** Everything the detail page renders, or null if Hotelbeds doesn't know the hotel. */
export async function getHotelContent(
  config: HotelbedsConfig,
  code: number,
  now = Date.now(),
): Promise<HotelContent | null> {
  const hit = detailCache.get(code);
  if (hit && now - hit.at < TTL_MS) return hit.content;

  const raw = await get<RawDetails>(config, `/hotel-content-api/1.0/hotels/${code}/details?language=ENG`);
  const h = raw.hotel;
  const content: HotelContent | null = h
    ? {
        code: h.code,
        name: h.name?.content ?? "",
        description: h.description?.content ?? "",
        address: h.address?.content ?? "",
        city: h.city?.content ?? "",
        zone: h.zone?.name ?? "",
        category: h.category?.description?.content ?? "",
        latitude: h.coordinates?.latitude ?? null,
        longitude: h.coordinates?.longitude ?? null,
        images: orderedPaths(h.images).slice(0, 12).map(photoUrl),
      }
    : null;
  remember(detailCache, code, { at: now, content });
  return content;
}
