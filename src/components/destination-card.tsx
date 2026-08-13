import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { asMedia } from "@/lib/content";
import type { Destination } from "@/payload-types";

/**
 * Harmonized with `PackageCard`: image above, caption below, no overlay —
 * the overlay-caption treatment DESIGN.md originally specified didn't hold up
 * against the actual photography and has been dropped.
 */
export function DestinationCard({ destination }: { destination: Destination }) {
  const cover = asMedia(destination.coverImage);

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {cover?.url ? (
          <Image
            src={cover.url}
            alt={cover.alt || destination.name}
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-label text-muted-foreground">
            Image coming soon
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <h3 className="text-heading">
          <Link href={`/destinations/${destination.slug}`} className="after:absolute after:inset-0">
            {destination.name}
          </Link>
        </h3>
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          View destination
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
