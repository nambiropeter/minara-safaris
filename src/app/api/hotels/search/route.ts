import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getKesRates } from "@/lib/exchange-rates";
import { getHotelbeds } from "@/lib/hotelbeds";
import { applyMargin, eurToDisplay, marginBpsFromEnv } from "@/lib/hotel-pricing";
import { searchHotels } from "@/lib/hotel-search";
import { SESSION_COOKIE, verifySession } from "@/lib/hotel-session";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** A real visitor can't pick dates and submit this fast; a script replaying the page can. */
const MIN_SESSION_AGE_MS = 2000;
const MAX_NIGHTS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Trust boundary. Like /api/checkout there is no price field to tamper with, and
 * strict objects reject extras. `destination` is a Hotelbeds destination code;
 * `currency` is a code, never a rate — the rate is looked up server-side.
 */
const searchSchema = z.strictObject({
  destination: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,5}$/),
  zone: z.coerce.number().int().min(1).max(9999).optional(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  adults: z.coerce.number().int().min(1).max(8),
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(6).default([]),
  currency: z.enum(["KES", "USD"]).default("KES"),
});

const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS);

export async function POST(request: NextRequest) {
  const config = getHotelbeds();
  if (!config) {
    return NextResponse.json({ error: "Hotel search is not available." }, { status: 503 });
  }

  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Session expired. Reload the page." }, { status: 401 });
  }
  if (Date.now() - session.issuedAt < MIN_SESSION_AGE_MS) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (
    !allowRequest(`hotel-search:session:${session.id}`, { maxRequests: 10, windowMs: 10 * 60 * 1000 }) ||
    !allowRequest(`hotel-search:ip:${ip}`, { maxRequests: 60, windowMs: 60 * 60 * 1000 })
  ) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { currency, ...search } = parsed.data;

  const nights = nightsBetween(search.checkIn, search.checkOut);
  const today = new Date().toISOString().slice(0, 10);
  if (nights < 1 || nights > MAX_NIGHTS || search.checkIn < today) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let marginBps: number;
  try {
    marginBps = marginBpsFromEnv();
  } catch (error) {
    console.error("hotel margin not configured", error);
    return NextResponse.json({ error: "Hotel search is not available." }, { status: 503 });
  }

  // Hotelbeds quotes EUR; without a rate there is no honest price to show.
  const rates = await getKesRates();
  if (!rates?.eurPerKes) {
    return NextResponse.json({ error: "Prices are temporarily unavailable." }, { status: 503 });
  }

  try {
    const hotels = await searchHotels(config, search);
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
          return [{ ...hotel, from: eurToDisplay(applyMargin(netFrom, marginBps), currency, rates) }];
        }),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("hotelbeds search failed", error);
    return NextResponse.json({ error: "Hotel search failed. Try again shortly." }, { status: 502 });
  }
}
