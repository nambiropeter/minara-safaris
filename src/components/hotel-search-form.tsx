"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MagnifyingGlass } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ensureHotelSession, parseStay, stayParams } from "@/lib/hotel-client";
import { findHotelDestination, HOTEL_DESTINATIONS } from "@/lib/hotel-destinations";

const inputClass = "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";
const labelClass = "flex flex-col gap-1 text-label text-muted-foreground";

const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Reads its starting values from the URL, so the same form sits on /hotels (empty,
 * or prefilled from a package's link) and on the results page (showing, and
 * letting you change, what you searched). A search is a navigation: the URL is the
 * state, which makes results shareable and the back button honest.
 */
export function HotelSearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = parseStay(params);

  const [destination, setDestination] = useState(findHotelDestination(params.get("destination"))?.slug ?? "nairobi");
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [childAges, setChildAges] = useState<number[]>(initial?.childAges ?? []);

  // Searches are refused for a session under two seconds old, so start it now.
  useEffect(() => {
    void ensureHotelSession();
  }, []);

  function changeCheckIn(value: string) {
    setCheckIn(value);
    if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
  }

  function changeChildCount(count: number) {
    setChildAges((ages) => Array.from({ length: count }, (_, i) => ages[i] ?? 8));
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = stayParams({ checkIn, checkOut, adults, childAges });
    query.set("destination", destination);
    router.push(`/hotels/search?${query}`);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Where
          <select value={destination} onChange={(e) => setDestination(e.target.value)} className={inputClass}>
            {HOTEL_DESTINATIONS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Check in
          <input
            type="date"
            required
            value={checkIn}
            min={isoToday()}
            onChange={(e) => changeCheckIn(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Check out
          <input
            type="date"
            required
            value={checkOut}
            min={checkIn ? addDays(checkIn, 1) : isoToday()}
            onChange={(e) => setCheckOut(e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Adults
            <select value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Children
            <select value={childAges.length} onChange={(e) => changeChildCount(Number(e.target.value))} className={inputClass}>
              {Array.from({ length: 5 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {childAges.length > 0 && (
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <legend className="mb-1 text-label text-muted-foreground">Age of each child on the day of travel</legend>
          {childAges.map((age, i) => (
            <label key={i} className={labelClass}>
              Child {i + 1}
              <select
                value={age}
                onChange={(e) => setChildAges((ages) => ages.map((a, j) => (j === i ? Number(e.target.value) : a)))}
                className={inputClass}
              >
                {Array.from({ length: 18 }, (_, a) => a).map((a) => (
                  <option key={a} value={a}>
                    {a === 0 ? "Under 1" : a}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}

      <Button type="submit" size="cta" className="w-full sm:w-fit">
        <MagnifyingGlass />
        Search hotels
      </Button>
    </form>
  );
}
