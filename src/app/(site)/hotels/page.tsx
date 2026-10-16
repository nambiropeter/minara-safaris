import type { Metadata } from "next";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { HotelSearchForm } from "@/components/hotel-search-form";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Hotels in Kenya and Tanzania",
  description:
    "Search hotels, lodges and beach resorts across Kenya and Tanzania with live availability and prices in shillings or dollars.",
  ...canonical("/hotels"),
};

export default function HotelsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <Breadcrumbs items={[{ label: "Hotels" }]} />
      <h1 className="text-display">Find a place to stay</h1>
      <p className="measure mt-3 text-lead text-muted-foreground">
        Hotels, lodges and beach resorts across Kenya and Tanzania. Choose a place and your dates to see what is
        available and what it costs.
      </p>
      <div className="mt-8">
        {/* useSearchParams needs a Suspense boundary, or the whole page opts out of static rendering. */}
        <Suspense fallback={<div className="h-48 rounded-xl border border-border bg-secondary/40" />}>
          <HotelSearchForm />
        </Suspense>
      </div>
    </main>
  );
}
