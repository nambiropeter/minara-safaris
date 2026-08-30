import Link from "next/link";

import { ArrowRight, MagnifyingGlass } from "@/components/icons";
import { Button } from "@/components/ui/button";

const TABS = [
  { key: "safaris", label: "Safaris & Tours", href: "/packages", active: true },
  { key: "hotels", label: "Hotels", href: "/contact", active: false },
  { key: "custom", label: "Custom Trip", href: "/contact", active: false },
] as const;

const QUICK_PICKS = [
  { label: "Maasai Mara", href: "/destinations/maasai-mara" },
  { label: "Diani Coast", href: "/destinations/diani-coast" },
  { label: "Amboseli", href: "/destinations/amboseli" },
];

/** Flat and squared, like everywhere else on the site — no drop shadow. */
export function SearchEntryBar() {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4 sm:p-5">
      <div className="flex flex-wrap gap-2 rounded-lg bg-background p-1 ring-1 ring-border">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            render={<Link href={tab.href} />}
            variant={tab.active ? "default" : "ghost"}
            size="sm"
            className="h-11 flex-1 justify-center"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <form action="/packages" method="get" className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-background px-4 text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <MagnifyingGlass className="size-4 shrink-0" />
          <input
            name="q"
            placeholder="Search destination, trip style, or keyword"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Button size="cta" type="submit">
          Search trips
          <ArrowRight />
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="text-label uppercase tracking-[0.2em] text-muted-foreground">
          Quick picks
        </span>
        {QUICK_PICKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex h-11 items-center rounded-full bg-background px-4 text-foreground ring-1 ring-border transition-colors hover:bg-muted"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
