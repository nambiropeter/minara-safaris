import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { HotelResults } from "@/components/hotel-results";
import { HotelSearchForm } from "@/components/hotel-search-form";

// Results are one visitor's query, not a page worth indexing.
export const metadata: Metadata = {
  title: "Hotel search",
  robots: { index: false, follow: true },
};

export default function HotelSearchPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <Breadcrumbs items={[{ label: "Hotels", href: "/hotels" }, { label: "Search" }]} />
      <h1 className="text-display">Hotels</h1>
      <div className="mt-8">
        <Suspense fallback={<div className="h-48 rounded-xl border border-border bg-secondary/40" />}>
          <HotelSearchForm />
        </Suspense>
      </div>
      <div className="mt-12">
        <Suspense fallback={<p className="text-muted-foreground">Checking availability…</p>}>
          <HotelResults />
        </Suspense>
      </div>
    </main>
  );
}
