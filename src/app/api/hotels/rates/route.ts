import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getHotelbeds } from "@/lib/hotelbeds";
import { describeCancellation, sellPrice } from "@/lib/hotel-pricing";
import { guardSession, invalidRequest, sellContext, stayFields, stayNights } from "@/lib/hotel-request";
import { hotelRates } from "@/lib/hotel-search";

export const runtime = "nodejs";

/**
 * Rooms and rates for one hotel, after the visitor picked it from a search. Net
 * prices never leave the server. Each rate carries the opaque `rateKey` the
 * browser sends back to /api/hotels/checkrate.
 */
const ratesSchema = z.strictObject({
  hotelCode: z.coerce.number().int().min(1).max(99_999_999),
  ...stayFields,
});

export async function POST(request: NextRequest) {
  const config = getHotelbeds();
  if (!config) {
    return NextResponse.json({ error: "Hotel search is not available." }, { status: 503 });
  }

  const refused = guardSession(request, "hotel-rates", {
    perSession: 20,
    perSessionWindowMs: 10 * 60 * 1000,
    perIp: 100,
  });
  if (refused) return refused;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = ratesSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();
  const { hotelCode, currency, ...stay } = parsed.data;

  const nights = stayNights(stay.checkIn, stay.checkOut);
  if (nights === null) return invalidRequest();

  const ctx = await sellContext(currency);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const hotel = await hotelRates(config, hotelCode, stay);
    if (!hotel) return NextResponse.json({ error: "Hotel not available for these dates." }, { status: 404 });
    if (hotel.currency !== "EUR") {
      console.error("hotelbeds returned a non-EUR price", { code: hotelCode, currency: hotel.currency });
      return NextResponse.json({ error: "Hotel search failed. Try again shortly." }, { status: 502 });
    }

    return NextResponse.json(
      {
        nights,
        currency,
        hotel: { code: hotel.code, name: hotel.name },
        rooms: hotel.rooms.map((room) => ({
          code: room.code,
          name: room.name,
          rates: room.rates.map((rate) => ({
            rateKey: rate.rateKey,
            board: { code: rate.boardCode, name: rate.boardName },
            from: sellPrice(rate.net, ctx),
            cancellation: describeCancellation(rate.cancellationPolicies, ctx),
          })),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("hotelbeds rates failed", error);
    return NextResponse.json({ error: "Hotel search failed. Try again shortly." }, { status: 502 });
  }
}
