import configPromise from "@payload-config";
import { getPayload } from "payload";

import type { Destination, Media, Package } from "@/payload-types";

/**
 * Server-side reads go straight through Payload's local API — no REST hop
 * between our own server and our own database (PRD §7).
 */
async function client() {
  return getPayload({ config: configPromise });
}

/** `depth: 2` resolves the destination relationship inside the destinations array. */
export async function getFeaturedPackages(limit = 6): Promise<Package[]> {
  const payload = await client();
  const { docs } = await payload.find({
    collection: "packages",
    where: { isPublished: { equals: true }, isFeatured: { equals: true } },
    sort: "-createdAt",
    limit,
    depth: 2,
  });
  return docs;
}

/** Offers are the exception, not the rule — this is empty most of the year. */
export async function getOfferPackages(limit = 4): Promise<Package[]> {
  const payload = await client();
  const { docs } = await payload.find({
    collection: "packages",
    where: { isPublished: { equals: true }, offerLabel: { exists: true } },
    sort: "-createdAt",
    limit,
    depth: 2,
  });
  return docs.filter((doc) => Boolean(doc.offerLabel));
}

export async function getDestinations(limit = 8): Promise<Destination[]> {
  const payload = await client();
  const { docs } = await payload.find({
    collection: "destinations",
    sort: "name",
    limit,
    depth: 1,
  });
  return docs;
}

/** Payload returns `number | Media` depending on depth; narrow it in one place. */
export function asMedia(value: number | Media | null | undefined): Media | null {
  return value && typeof value === "object" ? value : null;
}

export function asDestination(
  value: number | Destination | null | undefined,
): Destination | null {
  return value && typeof value === "object" ? value : null;
}

export function coverImage(pkg: Package): Media | null {
  const images = pkg.images ?? [];
  const cover = images.find((entry) => entry.isCover) ?? images[0];
  return cover ? asMedia(cover.image) : null;
}

export function destinationNames(pkg: Package): string[] {
  return (pkg.destinations ?? [])
    .map((entry) => asDestination(entry.destination)?.name)
    .filter((name): name is string => Boolean(name));
}
