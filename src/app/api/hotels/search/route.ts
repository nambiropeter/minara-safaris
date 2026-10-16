import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getHotelbeds } from "@/lib/hotelbeds";
import { getCoverImages } from "@/lib/hotel-content";
import { sellPrice } from "@/lib/hotel-pricing";
import { guardSession, invalidRequest, sellContext, stayFields, stayNights } from "@/lib/hotel-request";
import { searchHotels } from "@/lib/hotel-search";

export const runtime = "nodejs";

/**
 * Trust boundary. Like /api/checkout there is no price field to tamper with, and
 * strict objects reject extras. `destination` is a Hotelbeds destination code and
 * `zone` narrows it (Diani is zone 9 of MBA).
 */
const searchSchema = z.strictObject({
  destination: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,5}$/),
  zone: z.coerce.number().int().min(1).max(9999).optional(),
  ...stayFields,
});

export async function POST(request: NextRequest) {
  const config = getHotelbeds();
  if (!config) {
    return NextResponse.json({ error: "Hotel search is not available." }, { status: 503 });
  }

  const refused = guardSession(request, "hotel-search", {
    perSession: 10,
    perSessionWindowMs: 10 * 60 * 1000,
    perIp: 60,
  });
  if (refused) return refused;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();
  const { currency, ...search } = parsed.data;

  const nights = stayNights(search.checkIn, search.checkOut);
  if (nights === null) return invalidRequest();

  const ctx = await sellContext(currency);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const hotels = await searchHotels(config, search);
    const covers = await getCoverImages(config, hotels.map((hotel) => hotel.code));
    return NextResponse.json(
      {
        nights,
        currency,
        hotels: hotels.flatMap(({ netFrom, currency: supplierCurrency, ...hotel }) => {
          // The conversion assumes EUR. Drop anything else rather than misprice it.
          if (supplierCurrency !== "EUR") {
            console.error("hotelbeds returned a non-EUR price", { code: hotel.code, supplierCurrency });
            return [];
          }
          return [{ ...hotel, image: covers.get(hotel.code) ?? null, from: sellPrice(netFrom, ctx) }];
        }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("hotelbeds search failed", error);
    return NextResponse.json({ error: "Hotel search failed. Try again shortly." }, { status: 502 });
  }
}
