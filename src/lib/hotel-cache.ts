import configPromise from "@payload-config";
import { getPayload } from "payload";

/**
 * Postgres-backed cache for Hotelbeds lookups, shared by every instance (an in-process
 * map isn't: serverless instances each keep their own, which would multiply the very
 * requests look-to-book counts).
 *
 * A cache must never take search down. Every failure here is logged and treated as a
 * miss on read and a no-op on write, so the worst case is one extra supplier call.
 * ponytail: two instances missing the same key at the same instant both call Hotelbeds;
 * a lock would close that, at a cost not worth paying at this volume.
 */
const COLLECTION = "hotel-cache";

/** Entries are stored as `{ value }` so a lookup with no result is cacheable and the JSON field is never null. */
export async function readCache<T>(key: string, now = Date.now()): Promise<{ value: T } | undefined> {
  try {
    const payload = await getPayload({ config: configPromise });
    const { docs } = await payload.find({
      collection: COLLECTION,
      where: { and: [{ key: { equals: key } }, { expiresAt: { greater_than: new Date(now).toISOString() } }] },
      limit: 1,
      depth: 0,
      pagination: false,
    });
    return docs[0] ? (docs[0].body as { value: T }) : undefined;
  } catch (error) {
    console.error("hotel cache read failed", error);
    return undefined;
  }
}

export async function writeCache<T>(key: string, value: T, ttlMs: number, now = Date.now()): Promise<void> {
  try {
    const payload = await getPayload({ config: configPromise });
    const data = { body: { value } as never, expiresAt: new Date(now + ttlMs).toISOString() };

    // Expired rows are only ever dead weight; clearing them here keeps the table small without a scheduled job.
    await payload.delete({ collection: COLLECTION, where: { expiresAt: { less_than: new Date(now).toISOString() } } });

    const { docs } = await payload.find({
      collection: COLLECTION,
      where: { key: { equals: key } },
      limit: 1,
      depth: 0,
      pagination: false,
    });
    if (docs[0]) await payload.update({ collection: COLLECTION, id: docs[0].id, data });
    else await payload.create({ collection: COLLECTION, data: { key, ...data } });
  } catch (error) {
    console.error("hotel cache write failed", error);
  }
}
