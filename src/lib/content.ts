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

export async function getPackageBySlug(slug: string): Promise<Package | null> {
  const payload = await client();
  const { docs } = await payload.find({
    collection: "packages",
    where: { slug: { equals: slug }, isPublished: { equals: true } },
    limit: 1,
    depth: 2,
  });
  return docs[0] ?? null;
}

/** Same primary destination, different package — the catalogue is small enough that "related" just means "elsewhere in it". */
export async function getRelatedPackages(pkg: Package, limit = 3): Promise<Package[]> {
  const slugs = destinationNames(pkg);
  if (slugs.length === 0) return [];
  const all = await getPublishedPackages();
  return all
    .filter((other) => other.id !== pkg.id && destinationNames(other).some((name) => slugs.includes(name)))
    .slice(0, limit);
}

export async function getPublishedPackages(): Promise<Package[]> {
  const payload = await client();
  const { docs } = await payload.find({
    collection: "packages",
    where: { isPublished: { equals: true } },
    limit: 200,
    depth: 2,
  });
  return docs;
}

export type PackageFilters = {
  destination?: string;
  tag?: string;
  duration?: "short" | "medium" | "long";
  budget?: "low" | "mid" | "high";
};

export type PackageSort = "featured" | "price-asc" | "price-desc" | "duration-asc";

const DURATION_RANGES: Record<NonNullable<PackageFilters["duration"]>, [number, number]> = {
  short: [1, 3],
  medium: [4, 6],
  long: [7, Infinity],
};

/** KES only — a mixed-currency catalogue would need conversion first, and nothing sold here is in a second currency yet. */
const BUDGET_RANGES: Record<NonNullable<PackageFilters["budget"]>, [number, number]> = {
  low: [0, 50000],
  mid: [50000, 100000],
  high: [100000, Infinity],
};

export function filterPackages(packages: Package[], filters: PackageFilters): Package[] {
  return packages.filter((pkg) => {
    if (filters.destination) {
      const inDestination = (pkg.destinations ?? []).some(
        (entry) => asDestination(entry.destination)?.slug === filters.destination,
      );
      if (!inDestination) return false;
    }
    if (filters.tag && !(pkg.tags ?? []).includes(filters.tag)) return false;
    if (filters.duration) {
      const [min, max] = DURATION_RANGES[filters.duration];
      if (pkg.durationDays < min || pkg.durationDays > max) return false;
    }
    if (filters.budget) {
      const [min, max] = BUDGET_RANGES[filters.budget];
      if (pkg.priceFrom < min || pkg.priceFrom > max) return false;
    }
    return true;
  });
}

export function sortPackages(packages: Package[], sort: PackageSort): Package[] {
  const sorted = [...packages];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.priceFrom - b.priceFrom);
    case "price-desc":
      return sorted.sort((a, b) => b.priceFrom - a.priceFrom);
    case "duration-asc":
      return sorted.sort((a, b) => a.durationDays - b.durationDays);
    default:
      return sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }
}

export function packageTags(packages: Package[]): string[] {
  return Array.from(new Set(packages.flatMap((pkg) => pkg.tags ?? []))).sort();
}
