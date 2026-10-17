"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCurrencyPreference } from "@/components/currency-provider";
import { HotelPrice } from "@/components/hotel-price";
import { MapPin } from "@/components/icons";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { hotelPost, parseStay, stayParams, type HotelApiResult, type SearchResponse } from "@/lib/hotel-client";
import { findHotelDestination } from "@/lib/hotel-destinations";
import { nightsLabel } from "@/lib/hotel-format";

/** Hotelbeds ships categories in capitals ("4 STARS AND A HALF"); sentence case reads calmer. */
const tidy = (text: string) => (text ? text.charAt(0) + text.slice(1).toLowerCase() : "");

export function HotelResults() {
  const params = useSearchParams();
  const stay = useMemo(() => parseStay(params), [params]);
  const destination = findHotelDestination(params.get("destination"));
  const currency = useCurrencyPreference() ?? "KES";

  // Results are tagged with the request they answer, so "loading" is derived (the
  // stored answer is for a different request) and never set from inside the effect.
  const key = `${destination?.slug}|${params.toString()}|${currency}`;
  const [answer, setAnswer] = useState<{ key: string; result: HotelApiResult<SearchResponse> } | null>(null);

  useEffect(() => {
    if (!stay || !destination) return;
    let stale = false;
    void hotelPost<SearchResponse>("/api/hotels/search", {
      destination: destination.code,
      zone: destination.zone,
      ...stay,
      currency,
    }).then((result) => {
      if (!stale) setAnswer({ key, result });
    });
    return () => {
      stale = true;
    };
  }, [key, stay, destination, currency]);

  if (!stay || !destination) {
    return <p className="text-muted-foreground">Choose a place and your dates to see available hotels.</p>;
  }

  const result = answer?.key === key ? answer.result : null;
  if (!result) {
    return (
      <p role="status" className="text-muted-foreground">
        Checking availability in {destination.label}…
      </p>
    );
  }

  if (!result.ok) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4">
        <p className="text-destructive">{result.error}</p>
        <WhatsAppCta context={`a hotel in ${destination.label}`} />
      </div>
    );
  }

  const { hotels, nights } = result.data;
  if (hotels.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground">
          No hotels are available in {destination.label} for these dates. Try different dates or another area, or ask us
          and we will look for you.
        </p>
        <WhatsAppCta context={`a hotel in ${destination.label}`} />
      </div>
    );
  }

  const detailQuery = stayParams(stay);
  detailQuery.set("destination", destination.slug);
  const pkg = params.get("package");
  if (pkg) detailQuery.set("package", pkg);
  const sorted = [...hotels].sort((a, b) => a.from - b.from);

  return (
    <section aria-live="polite">
      <h2 className="text-title">
        {hotels.length} {hotels.length === 1 ? "hotel" : "hotels"} in {destination.label}
      </h2>
      <p className="mt-1 text-muted-foreground">{nightsLabel(nights)}, lowest price first.</p>

      <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((hotel) => (
          <li key={hotel.code}>
            <article className="group relative flex h-full flex-col">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                {hotel.image ? (
                  <Image
                    src={hotel.image}
                    alt={hotel.name}
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-label text-muted-foreground">
                    Photos coming soon
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-1 flex-col gap-2">
                <h3 className="text-heading">
                  <Link href={`/hotels/${hotel.code}?${detailQuery}`} className="after:absolute after:inset-0">
                    {hotel.name}
                  </Link>
                </h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {[hotel.zone, hotel.destination].filter(Boolean).join(", ")}
                  </li>
                  {hotel.category && <li>{tidy(hotel.category)}</li>}
                </ul>
                <HotelPrice amount={hotel.from} currency={currency} nights={nights} lead="From" className="mt-auto pt-2" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
