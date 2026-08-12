"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Destination } from "@/payload-types";

const DURATIONS = [
  { value: "short", label: "1–3 days" },
  { value: "medium", label: "4–6 days" },
  { value: "long", label: "7+ days" },
];

const BUDGETS = [
  { value: "low", label: "Under KES 50,000" },
  { value: "mid", label: "KES 50,000–100,000" },
  { value: "high", label: "Over KES 100,000" },
];

const SORTS = [
  { value: "featured", label: "Featured first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "duration-asc", label: "Shortest first" },
];

const FILTER_KEYS = ["destination", "tag", "duration", "budget"];

/**
 * URL search params are the state here, not client state — filters stay
 * shareable and survive a refresh, and the page itself does the filtering
 * server-side on every navigation.
 */
export function PackageFiltersBar({
  destinations,
  tags,
}: {
  destinations: Destination[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(params.size > 0 ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Destination"
        value={searchParams.get("destination") ?? ""}
        onChange={(v) => update("destination", v)}
      >
        <option value="">All destinations</option>
        {destinations.map((destination) => (
          <option key={destination.slug} value={destination.slug}>
            {destination.name}
          </option>
        ))}
      </FilterSelect>

      {tags.length > 0 && (
        <FilterSelect label="Trip style" value={searchParams.get("tag") ?? ""} onChange={(v) => update("tag", v)}>
          <option value="">All styles</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </FilterSelect>
      )}

      <FilterSelect label="Duration" value={searchParams.get("duration") ?? ""} onChange={(v) => update("duration", v)}>
        <option value="">Any length</option>
        {DURATIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="Budget" value={searchParams.get("budget") ?? ""} onChange={(v) => update("budget", v)}>
        <option value="">Any budget</option>
        {BUDGETS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect label="Sort" value={searchParams.get("sort") ?? "featured"} onChange={(v) => update("sort", v)}>
        {SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname, { scroll: false })}
          className="h-11 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-label text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 min-w-40 rounded-md border border-border bg-background px-3 text-sm text-foreground"
      >
        {children}
      </select>
    </label>
  );
}
