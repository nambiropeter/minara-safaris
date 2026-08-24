import type { Metadata } from "next";

import { DestinationCard } from "@/components/destination-card";
import { getAllDestinations } from "@/lib/content";
import { canonical } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Destinations",
  description: "Explore safari and coast destinations across Kenya and East Africa.",
  ...canonical("/destinations"),
};

export default async function DestinationsPage() {
  const destinations = await getAllDestinations();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-display">Destinations</h1>
        <p className="measure mt-4 text-lead text-muted-foreground">
          Parks, coast, and cross-border combinations. Pick a place to see
          packages that already run there.
        </p>
      </div>

      {destinations.length > 0 ? (
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="sr-only">Results</h2>
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-heading">No destinations published yet</p>
          <p className="measure mx-auto mt-2 text-muted-foreground">
            Destinations are being added now. Check back shortly.
          </p>
        </div>
      )}
    </main>
  );
}
