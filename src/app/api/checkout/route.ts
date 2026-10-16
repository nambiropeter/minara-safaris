import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { convertPrice, getKesRates, isDisplayCurrency } from "@/lib/exchange-rates";
import { priceOrder, type PriceablePackage } from "@/lib/pricing";
import { allowRequest } from "@/lib/rate-limit";
import { startCheckout } from "@/lib/start-checkout";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Trust boundary. Note what is absent: there is no `amount` field. The client
 * cannot express a price, so it cannot tamper with one — and strict objects
 * reject a request that tries, rather than quietly dropping the field.
 */
const checkoutSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        kind: z.literal("package"),
        refId: z.string().trim().min(1).max(64),
        quantity: z.coerce.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(10),
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email().trim(),
  customerPhone: z.string().trim().max(50).optional(),
  travelDate: z.iso.date().optional(),
  adults: z.coerce.number().int().min(1).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  /** A currency code, never a rate — the rate is looked up server-side. */
  currency: z.enum(["KES", "USD"]).optional(),
});

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(`checkout:${ip}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const data = parsed.data;

  const payload = await getPayload({ config: configPromise });

  const found = await payload.find({
    collection: "packages",
    where: {
      id: { in: data.items.map((i) => i.refId) },
      isPublished: { equals: true },
    },
    limit: 10,
    depth: 0,
  });

  // Converting here, before pricing, means the order, Stripe and the invoice
  // all carry the chosen currency. The same `convertPrice` rendered the figure
  // the visitor saw, so the charge matches it. No rate → native currency.
  const rates = data.currency ? await getKesRates() : null;
  const target = rates ? data.currency : undefined;
  const catalogue = new Map<string, PriceablePackage>(
    found.docs.map((d) => {
      const native = isDisplayCurrency(d.currency) ? d.currency : "KES";
      const to = target ?? native;
      return [
        String(d.id),
        {
          id: d.id,
          title: d.title,
          priceFrom: convertPrice(d.priceFrom, native, to, rates?.usdPerKes ?? 1),
          currency: to,
        },
      ];
    }),
  );
  const converted = found.docs.some((d) => target && (d.currency ?? "KES") !== target);

  let priced;
  try {
    priced = priceOrder(data.items, (refId) => catalogue.get(refId));
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const started = await startCheckout({
    payload,
    stripe,
    origin: process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin,
    cancelPath: "/packages",
    order: {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      items: priced.items,
      currency: priced.currency,
      amountTotal: priced.amountTotal,
      travelDate: data.travelDate,
      adults: data.adults,
      children: data.children,
      staffNotes:
        converted && rates
          ? `Charged in ${target} at 1 KES = ${rates.usdPerKes} USD (exchangerate-api, ${rates.updatedAt}).`
          : undefined,
    },
    lineItems: priced.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: priced.currency.toLowerCase(),
        unit_amount: item.unitAmount,
        product_data: { name: item.title },
      },
    })),
  });
  if (!started.ok) {
    return NextResponse.json({ error: "Payment could not be started. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ url: started.url });
}
