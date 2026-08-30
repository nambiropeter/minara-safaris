"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FadersHorizontal } from "@phosphor-icons/react";

import type { Destination } from "@/payload-types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(params.size > 0 ? `${pathname}?${params}` : pathname, { scroll: false });
  }

  function clear() {
    router.push(pathname, { scroll: false });
  }

  let activeCount = 0;
  FILTER_KEYS.forEach((key) => {
    if (searchParams.has(key)) activeCount++;
  });

  const filterContent = (
    <div className="flex flex-col gap-6 px-4 py-2 sm:px-6">
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

      <div className="my-2 h-px bg-border" />

      <FilterSelect label="Sort" value={searchParams.get("sort") ?? "featured"} onChange={(v) => update("sort", v)}>
        {SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clear}
          className="mt-2 h-11 w-full rounded-md text-sm font-medium text-primary underline-offset-4 hover:bg-secondary hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );

  const triggerButton = (
    <Button variant="outline" className="gap-2">
      <FadersHorizontal className="size-4" weight="bold" />
      Filters {activeCount > 0 && `(${activeCount})`}
    </Button>
  );

  if (isDesktop) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Sheet>
          <SheetTrigger render={triggerButton} />
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader className="sm:px-6">
              <SheetTitle>Filters & Sort</SheetTitle>
              <SheetDescription>Refine your search to find the perfect safari.</SheetDescription>
            </SheetHeader>
            {filterContent}
          </SheetContent>
        </Sheet>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Drawer>
        <DrawerTrigger render={triggerButton} />
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Filters & Sort</DrawerTitle>
            <DrawerDescription>Refine your search to find the perfect safari.</DrawerDescription>
          </DrawerHeader>
          <div className="pb-8">{filterContent}</div>
        </DrawerContent>
      </Drawer>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Clear
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
    <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 min-w-40 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {children}
      </select>
    </label>
  );
}
