import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { generateBookingToken } from "@/lib/booking-token";
import { priceOrder, type PriceablePackage } from "@/lib/pricing";
import { allowRequest } from "@/lib/rate-limit";
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
  const catalogue = new Map<string, PriceablePackage>(
    found.docs.map((d) => [
      String(d.id),
      { id: d.id, title: d.title, priceFrom: d.priceFrom, currency: d.currency },
    ]),
  );

  let priced;
  try {
    priced = priceOrder(data.items, (refId) => catalogue.get(refId));
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { token, hash } = generateBookingToken();
  const orderNumber = `MS-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

  const order = await payload.create({
    collection: "orders",
    data: {
      orderNumber,
      status: "pending",
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      items: priced.items,
      currency: priced.currency,
      amountTotal: priced.amountTotal,
      travelDate: data.travelDate,
      adults: data.adults,
      children: data.children,
      accessTokenHash: hash,
    },
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    invoice_creation: { enabled: true },
    customer_email: data.customerEmail,
    client_reference_id: String(order.id),
    metadata: { orderId: String(order.id), bookingToken: token },
    line_items: priced.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: priced.currency.toLowerCase(),
        unit_amount: item.unitAmount,
        product_data: { name: item.title },
      },
    })),
    success_url: `${origin}/booking/${token}?paid=1`,
    cancel_url: `${origin}/packages`,
  });

  await payload.update({
    collection: "orders",
    id: order.id,
    data: { stripe: { checkoutSessionId: session.id } },
  });

  return NextResponse.json({ url: session.url });
}
