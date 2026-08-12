import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { getAllDestinations, asMedia } from "@/lib/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Destinations",
  description: "Explore safari and coast destinations across Kenya and East Africa.",
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
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => {
            const cover = asMedia(destination.coverImage);
            return (
              <li key={destination.id}>
                <Link
                  href={`/destinations/${destination.slug}`}
                  className="group block overflow-hidden rounded-xl border border-border"
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    {cover?.url ? (
                      <Image
                        src={cover.url}
                        alt={cover.alt}
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-label text-muted-foreground">
                        Image coming soon
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                    <p className="absolute inset-x-0 bottom-0 p-4 font-heading text-heading text-white">
                      {destination.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-primary">
                    View destination
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
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
