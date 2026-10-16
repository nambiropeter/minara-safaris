import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getKesRates, type DisplayCurrency } from "./exchange-rates";
import { marginBpsFromEnv, type SellContext } from "./hotel-pricing";
import { SESSION_COOKIE, verifySession } from "./hotel-session";
import { allowRequest } from "./rate-limit";

/**
 * Shared front door for the /api/hotels routes that reach Hotelbeds: the session
 * gate, rate limits and stay validation. One copy, so a rule can't drift between
 * routes.
 */

/** A real visitor can't pick dates and submit this fast; a script replaying the page can. */
const MIN_SESSION_AGE_MS = 2000;
const MAX_NIGHTS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fields every stay-based request carries. `currency` is a code, never a rate. */
export const stayFields = {
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  adults: z.coerce.number().int().min(1).max(8),
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(6).default([]),
  currency: z.enum(["KES", "USD"]).default("KES"),
};

/** Whole nights, or null when the stay is nonsense (backwards, too long, in the past). */
export function stayNights(checkIn: string, checkOut: string): number | null {
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS);
  const today = new Date().toISOString().slice(0, 10);
  return nights < 1 || nights > MAX_NIGHTS || checkIn < today ? null : nights;
}

/**
 * Margin and the EUR rate, or the response to send instead. Both must exist: with
 * no margin we'd sell at cost, with no rate we'd show a guessed price.
 */
export async function sellContext(currency: DisplayCurrency): Promise<SellContext | NextResponse> {
  let marginBps: number;
  try {
    marginBps = marginBpsFromEnv();
  } catch (error) {
    console.error("hotel margin not configured", error);
    return NextResponse.json({ error: "Hotel search is not available." }, { status: 503 });
  }
  const rates = await getKesRates();
  if (!rates?.eurPerKes) {
    return NextResponse.json({ error: "Prices are temporarily unavailable." }, { status: 503 });
  }
  return { marginBps, currency, rates };
}

export const invalidRequest =() => NextResponse.json({ error: "Invalid request." }, { status: 400 });
const tooMany = () => NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });

/**
 * Returns a ready-made error response when the request must be refused, or null
 * to carry on. `scope` keeps each route's limits separate.
 */
export function guardSession(
  request: NextRequest,
  scope: string,
  limits: { perSession: number; perSessionWindowMs: number; perIp: number },
): NextResponse | null {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Session expired. Reload the page." }, { status: 401 });
  }
  if (Date.now() - session.issuedAt < MIN_SESSION_AGE_MS) return tooMany();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (
    !allowRequest(`${scope}:session:${session.id}`, {
      maxRequests: limits.perSession,
      windowMs: limits.perSessionWindowMs,
    }) ||
    !allowRequest(`${scope}:ip:${ip}`, { maxRequests: limits.perIp, windowMs: 60 * 60 * 1000 })
  ) {
    return tooMany();
  }
  return null;
}
