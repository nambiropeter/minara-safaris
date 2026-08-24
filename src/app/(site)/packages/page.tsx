import type { Metadata } from "next";

import { PackageCard } from "@/components/package-card";
import { PackageFiltersBar } from "@/components/package-filters";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  filterPackages,
  getDestinations,
  getPublishedPackages,
  packageTags,
  sortPackages,
  type PackageFilters,
  type PackageSort,
} from "@/lib/content";
import { canonical } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Packages",
  description: "Fixed safari and tour itineraries across Kenya and East Africa, with published prices.",
  ...canonical("/packages"),
};

const SORTS: PackageSort[] = ["featured", "price-asc", "price-desc", "duration-asc"];
const DURATIONS: PackageFilters["duration"][] = ["short", "medium", "long"];
const BUDGETS: PackageFilters["budget"][] = ["low", "mid", "high"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type PackagesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const params = (await searchParams) ?? {};
  const destination = first(params.destination);
  const tag = first(params.tag);
  const duration = DURATIONS.find((v) => v === first(params.duration));
  const budget = BUDGETS.find((v) => v === first(params.budget));
  const query = first(params.q);
  const sort = SORTS.find((v) => v === first(params.sort)) ?? "featured";

  const [allPackages, destinations] = await Promise.all([
    getPublishedPackages(),
    getDestinations(20),
  ]);

  const filters: PackageFilters = { destination, tag, duration, budget, query };
  const filtered = sortPackages(filterPackages(allPackages, filters), sort);
  const tags = packageTags(allPackages);
  const hasFilters = Boolean(destination || tag || duration || budget);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-display">Packages</h1>
        <p className="measure mt-4 text-lead text-muted-foreground">
          Fixed itineraries with published prices.
        </p>
      </div>

      <div className="mt-8">
        <PackageFiltersBar destinations={destinations} tags={tags} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "package" : "packages"}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="sr-only">Results</h2>
          {filtered.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-heading">
            {hasFilters ? "No packages match those filters" : "No packages published yet"}
          </p>
          <p className="measure mx-auto mt-2 text-muted-foreground">
            {hasFilters
              ? "Clear a filter or two, or message us directly and we'll build something around what you want."
              : "Trips are being written up now. Message us in the meantime and we'll put something together from scratch."}
          </p>
          <div className="mt-6 flex justify-center">
            <WhatsAppCta label={hasFilters ? "Ask us directly" : "Tell us what you want"} />
          </div>
        </div>
      )}
    </main>
  );
}
