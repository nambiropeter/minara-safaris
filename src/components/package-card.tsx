import Image from "next/image";
import Link from "next/link";

import { CalendarBlank, MapPin } from "@/components/icons";
import { PriceBlock } from "@/components/price-block";
import { coverImage, destinationNames } from "@/lib/content";
import type { Package } from "@/payload-types";

/**
 * The catalogue's atom. Home is where it first appears; the catalogue,
 * destination pages and related-package rails all reuse it, so the shape is
 * decided here once.
 */
export function PackageCard({ pkg }: { pkg: Package }) {
  const cover = coverImage(pkg);
  const places = destinationNames(pkg);

  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
        {cover?.url ? (
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-label text-muted-foreground">
            Image coming soon
          </div>
        )}
        {pkg.offerLabel && (
          <p className="absolute top-3 left-3 rounded-md bg-gold px-2.5 py-1 text-label font-medium text-gold-foreground">
            {pkg.offerLabel}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        <h3 className="text-heading">
          <Link href={`/packages/${pkg.slug}`} className="after:absolute after:inset-0">
            {pkg.title}
          </Link>
        </h3>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {places.length > 0 && (
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {places.join(" · ")}
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <CalendarBlank className="size-4" />
            {pkg.durationDays} {pkg.durationDays === 1 ? "day" : "days"}
          </li>
        </ul>

        <p className="text-sm text-muted-foreground">{pkg.summary}</p>

        <PriceBlock pkg={pkg} className="mt-auto pt-2" />
      </div>
    </article>
  );
}
