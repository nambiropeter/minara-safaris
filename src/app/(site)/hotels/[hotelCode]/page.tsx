import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { HotelRates } from "@/components/hotel-rates";
import { MapPin } from "@/components/icons";
import { ImageLightbox } from "@/components/image-lightbox";
import { getHotelContent } from "@/lib/hotel-content";
import { getHotelbeds } from "@/lib/hotelbeds";
import { canonical } from "@/lib/seo";

// Content is cached for a day in the lib; the rates below it are fetched in the browser per visitor.
export const revalidate = 86_400;

type RouteProps = { params: Promise<{ hotelCode: string }> };

async function load(hotelCode: string) {
  const code = Number(hotelCode);
  const config = getHotelbeds();
  if (!Number.isInteger(code) || code < 1 || !config) return null;
  return getHotelContent(config, code);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { hotelCode } = await params;
  const hotel = await load(hotelCode);
  if (!hotel) return {};
  return {
    title: hotel.name,
    description: hotel.description.slice(0, 155),
    // The dates in the query string make endless near-duplicates; they all point here.
    ...canonical(`/hotels/${hotel.code}`),
  };
}

export default async function HotelPage({ params }: RouteProps) {
  const { hotelCode } = await params;
  const hotel = await load(hotelCode);
  if (!hotel) notFound();

  const place = [hotel.zone, hotel.city].filter(Boolean).join(", ");
  const photos = hotel.images.slice(0, 9).map((url, i) => ({ id: i, url, alt: `${hotel.name}, photo ${i + 1}` }));
  const hasMap = hotel.latitude !== null && hotel.longitude !== null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <Breadcrumbs items={[{ label: "Hotels", href: "/hotels" }, { label: hotel.name }]} />

      <h1 className="text-display">{hotel.name}</h1>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {place && (
          <li className="flex items-center gap-1.5">
            <MapPin className="size-4" />
            {place}
          </li>
        )}
        {hotel.category && <li>{hotel.category.charAt(0) + hotel.category.slice(1).toLowerCase()}</li>}
      </ul>

      {photos.length > 0 && <ImageLightbox images={photos} />}

      <section className="mt-12" aria-labelledby="rooms">
        <h2 id="rooms" className="text-title">
          Rooms and prices
        </h2>
        <div className="mt-4">
          <Suspense fallback={<p className="text-muted-foreground">Loading rooms and prices…</p>}>
            <HotelRates hotelCode={hotel.code} hotelName={hotel.name} />
          </Suspense>
        </div>
      </section>

      {hotel.description && (
        <section className="mt-12">
          <h2 className="text-title">About this hotel</h2>
          <p className="measure mt-3 whitespace-pre-line text-foreground">{hotel.description}</p>
        </section>
      )}

      {(hotel.address || hasMap) && (
        <section className="mt-12">
          <h2 className="text-title">Location</h2>
          {hotel.address && <p className="mt-3 text-muted-foreground">{[hotel.address, hotel.city].filter(Boolean).join(", ")}</p>}
          {hasMap && (
            <a
              href={`https://www.openstreetmap.org/?mlat=${hotel.latitude}&mlon=${hotel.longitude}#map=15/${hotel.latitude}/${hotel.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-primary underline underline-offset-4"
            >
              View on a map
            </a>
          )}
        </section>
      )}
    </main>
  );
}
