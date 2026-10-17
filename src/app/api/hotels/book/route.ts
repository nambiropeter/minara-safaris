import { NextResponse, type NextRequest } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { priceBundlePackage } from "@/lib/bundle";
import { checkRate, getHotelbeds, HotelbedsError } from "@/lib/hotelbeds";
import { nightsLabel } from "@/lib/hotel-format";
import { describeCancellation, sellPrice } from "@/lib/hotel-pricing";
import { guardSession, invalidRequest, sellContext, stayFields } from "@/lib/hotel-request";
import { addHotel } from "@/lib/pricing";
import { startCheckout } from "@/lib/start-checkout";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** Hotelbeds wants real names. Letters from any script, plus the punctuation names use. */
const name = z.string().trim().min(1).max(50).regex(/^[\p{L}\p{M}' .-]+$/u);

/**
 * Trust boundary, and the only route that starts hotel money moving. As with
 * /api/checkout there is no price field: `shownFrom` is only the figure the visitor was
 * looking at, compared against the server's own, never used as an amount. There are no
 * dates either: the rateKey encodes the stay, so the dates come from CheckRate, not from
 * a browser that could claim different ones.
 *
 * With `package`, the order carries the package too, priced here from the catalogue for the
 * whole party; as with the hotel, the browser's figure is only compared, never charged.
 *
 * `guests` is adults first, then children in the order of `childAges`. The first guest
 * is the booking holder.
 */
const bookSchema = z.strictObject({
  rateKey: z.string().min(1).max(1000),
  shownFrom: z.number().int().min(0),
  adults: stayFields.adults,
  childAges: stayFields.childAges,
  currency: stayFields.currency,
  guests: z.array(z.strictObject({ firstName: name, lastName: name })).min(1).max(14),
  customerEmail: z.email().trim(),
  customerPhone: z.string().trim().max(50).optional(),
  /** Optional: bundle with a "choose your own hotel" package. The subtotal is only what the visitor saw. */
  package: z.strictObject({ id: z.string().trim().min(1).max(64), shownSubtotal: z.number().int().min(0) }).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const config = getHotelbeds();
  if (!stripe || !config) {
    return NextResponse.json({ error: "Hotel booking is not available." }, { status: 503 });
  }

  // Each call can create an order and a Stripe session, so this is tighter than search.
  const refused = guardSession(request, "hotel-book", { perSession: 5, perSessionWindowMs: 10 * 60 * 1000, perIp: 10 });
  if (refused) return refused;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();
  const data = parsed.data;

  if (data.guests.length !== data.adults + data.childAges.length) return invalidRequest();

  const ctx = await sellContext(data.currency);
  if (ctx instanceof NextResponse) return ctx;

  // Always re-checked here, never trusted from the browser's earlier CheckRate: the price
  // charged is the one Hotelbeds confirms now.
  let checked;
  try {
    checked = await checkRate(config, data.rateKey);
  } catch (error) {
    if (error instanceof HotelbedsError && error.status >= 400 && error.status < 500 && ![401, 403, 429].includes(error.status)) {
      return NextResponse.json({ error: "This rate is no longer available." }, { status: 409 });
    }
    console.error("hotelbeds checkrate failed during booking", error);
    return NextResponse.json({ error: "Could not confirm this rate. Try again shortly." }, { status: 502 });
  }

  if (checked.currency !== "EUR") {
    console.error("hotelbeds returned a non-EUR price", { currency: checked.currency });
    return NextResponse.json({ error: "Hotel booking is not available." }, { status: 502 });
  }
  if (checked.rate.rateType !== "BOOKABLE" || checked.paymentDataRequired) {
    return NextResponse.json({ error: "This rate can't be booked online." }, { status: 409 });
  }
  // A rateKey is for one party size; booking it for another would be refused after payment.
  if (checked.adults !== data.adults || checked.children !== data.childAges.length) return invalidRequest();

  const nights = Math.round((Date.parse(checked.checkOut) - Date.parse(checked.checkIn)) / DAY_MS);
  if (!(nights >= 1) || checked.checkIn < new Date().toISOString().slice(0, 10)) return invalidRequest();

  const from = sellPrice(checked.rate.net, ctx);
  if (from !== data.shownFrom) {
    return NextResponse.json(
      { error: "The price has changed.", priceChanged: true, from, previousFrom: data.shownFrom },
      { status: 409 },
    );
  }

  const board = checked.rate.boardName.toLowerCase();
  const title = `${checked.hotelName}, ${checked.roomName}, ${board}, ${nightsLabel(nights)}`;
  const guests = data.guests.map((g, i) => {
    const age = i >= data.adults ? data.childAges[i - data.adults] : undefined;
    return { type: age === undefined ? "AD" : "CH", name: g.firstName, surname: g.lastName, ...(age !== undefined && { age }) };
  });
  const holder = data.guests[0];

  const payload = await getPayload({ config: configPromise });

  let packageLine = null;
  if (data.package) {
    packageLine = await priceBundlePackage(payload, data.package.id, ctx.currency, data.adults + data.childAges.length, ctx.rates);
    if (!packageLine) return invalidRequest();
    if (packageLine.subtotal !== data.package.shownSubtotal) {
      return NextResponse.json({ error: "The package price has changed. Please reload the page and try again." }, { status: 409 });
    }
  }
  const priced = addHotel(
    { items: packageLine ? [packageLine] : [], currency: ctx.currency, amountTotal: packageLine?.subtotal ?? 0 },
    { refId: String(checked.hotelCode), title, amount: from, currency: ctx.currency },
  );
  const started = await startCheckout({
    payload,
    stripe,
    origin: process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin,
    cancelPath: `/hotels/${checked.hotelCode}`,
    order: {
      customerName: `${holder.firstName} ${holder.lastName}`,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      items: priced.items,
      currency: priced.currency,
      amountTotal: priced.amountTotal,
      travelDate: checked.checkIn,
      adults: data.adults,
      children: data.childAges.length,
      supplier: {
        name: "hotelbeds",
        status: "pending",
        hotelCode: checked.hotelCode,
        hotelName: checked.hotelName,
        roomName: checked.roomName,
        boardName: checked.rate.boardName,
        checkIn: checked.checkIn,
        checkOut: checked.checkOut,
        guests,
        rateKey: checked.rate.rateKey,
        netAmount: checked.rate.net,
        marginBps: ctx.marginBps,
        fxEurPerKes: ctx.rates.eurPerKes,
        fxUsdPerKes: ctx.rates.usdPerKes,
        cancellationPolicies: describeCancellation(checked.rate.cancellationPolicies, ctx).policies,
        rateComments: checked.comments,
      },
    },
    lineItems: priced.items.map((item) => ({
      quantity: item.quantity,
      price_data: { currency: priced.currency.toLowerCase(), unit_amount: item.unitAmount, product_data: { name: item.title } },
    })),
  });

  if (!started.ok) {
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ url: started.url }, { headers: { "Cache-Control": "private, no-store" } });
}
