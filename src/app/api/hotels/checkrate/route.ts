import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { checkRate, getHotelbeds, HotelbedsError } from "@/lib/hotelbeds";
import { describeCancellation, sellPrice } from "@/lib/hotel-pricing";
import { guardSession, invalidRequest, sellContext } from "@/lib/hotel-request";

export const runtime = "nodejs";

/**
 * Re-prices the chosen rate with Hotelbeds before anyone is asked to pay.
 *
 * `rateKey` is opaque: no trim, no transform, passed through byte for byte.
 * `shownFrom` is only what the visitor was looking at, used to tell them if the
 * price moved. It is never trusted as a price.
 */
const checkrateSchema = z.strictObject({
  rateKey: z.string().min(1).max(1000),
  shownFrom: z.number().int().min(0),
  currency: z.enum(["KES", "USD"]).default("KES"),
});

/** Hotelbeds answers 4xx when a rate has expired or sold out; that's the customer's problem to retry, not ours. */
const isGone = (error: unknown) =>
  error instanceof HotelbedsError && error.status >= 400 && error.status < 500 && ![401, 403, 429].includes(error.status);

export async function POST(request: NextRequest) {
  const config = getHotelbeds();
  if (!config) {
    return NextResponse.json({ error: "Hotel booking is not available." }, { status: 503 });
  }

  const refused = guardSession(request, "hotel-checkrate", {
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
  const parsed = checkrateSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();
  const { rateKey, shownFrom, currency } = parsed.data;

  const ctx = await sellContext(currency);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const checked = await checkRate(config, rateKey);
    if (checked.currency !== "EUR") {
      console.error("hotelbeds returned a non-EUR price", { currency: checked.currency });
      return NextResponse.json({ error: "Hotel booking is not available." }, { status: 502 });
    }
    // Still RECHECK after a recheck means it is not bookable.
    if (checked.rate.rateType !== "BOOKABLE") {
      return NextResponse.json({ error: "This rate is no longer available." }, { status: 409 });
    }

    const from = sellPrice(checked.rate.net, ctx);
    return NextResponse.json(
      {
        // Booking must use this key, not the one the browser sent: Hotelbeds may reissue it.
        rateKey: checked.rate.rateKey,
        board: { code: checked.rate.boardCode, name: checked.rate.boardName },
        comments: checked.comments,
        from,
        previousFrom: shownFrom,
        priceChanged: from !== shownFrom,
        cancellation: describeCancellation(checked.rate.cancellationPolicies, ctx),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (isGone(error)) {
      return NextResponse.json({ error: "This rate is no longer available." }, { status: 409 });
    }
    console.error("hotelbeds checkrate failed", error);
    return NextResponse.json({ error: "Could not confirm this rate. Try again shortly." }, { status: 502 });
  }
}
