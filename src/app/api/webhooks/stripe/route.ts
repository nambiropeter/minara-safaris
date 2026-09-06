import { NextResponse } from "next/server";
import { getPayload } from "payload";

import configPromise from "@payload-config";
import { getStripe } from "@/lib/stripe";
import { assertAmountMatches } from "@/lib/webhook-guards";

export const runtime = "nodejs";

/**
 * The only code path that may mark an order paid.
 *
 * Order of operations matters: verify the signature against the RAW body,
 * then claim the event id, then act. Claiming first is what makes a Stripe
 * retry a no-op instead of a second fulfilment.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Must be the unparsed body. Any JSON parsing before this breaks verification.
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = await getPayload({ config: configPromise });

  // Claim the event before doing any work. A duplicate key means a retry.
  try {
    await payload.create({
      collection: "processed-events",
      data: { eventId: event.id, type: event.type },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ received: true });

    const order = await payload.findByID({ collection: "orders", id: orderId, depth: 0 });

    try {
      assertAmountMatches(
        { amount_total: session.amount_total, currency: session.currency },
        { amountTotal: order.amountTotal, currency: order.currency },
      );
    } catch (error) {
      await payload.update({
        collection: "orders",
        id: orderId,
        data: {
          status: "failed",
          staffNotes: `${order.staffNotes ?? ""}\nPayment refused: ${(error as Error).message}`.trim(),
        },
      });
      return NextResponse.json({ received: true, refused: true });
    }

    await payload.update({
      collection: "orders",
      id: orderId,
      data: {
        status: "paid",
        customerEmail: session.customer_details?.email ?? order.customerEmail,
        stripe: {
          checkoutSessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        },
      },
    });
  }

  return NextResponse.json({ received: true });
}
