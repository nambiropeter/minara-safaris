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
  let claimedEvent;
  try {
    claimedEvent = await payload.create({
      collection: "processed-events",
      data: { eventId: event.id, type: event.type },
    });
  } catch (error) {
    // Could be a genuine unique-constraint duplicate (correct to no-op) or a
    // transient DB error (NOT a duplicate — should have retried). We don't
    // trust-fall into distinguishing those from the error shape, but we do
    // log so an operator can tell the two apart after the fact.
    console.error("processed-events claim failed", error, { eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ received: true });

    // Delayed-notification payment methods (SEPA, Bacs, us_bank_account,
    // konbini, ...) fire this event with payment_status "unpaid" and only
    // succeed later via checkout.session.async_payment_succeeded. Nothing
    // handles that event yet, so just ignore what we can't fulfil correctly.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    try {
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
    } catch (error) {
      console.error("webhook fulfilment failed after claiming event", error, {
        eventId: event.id,
        orderId,
      });
      // Un-claim so a genuine retry can re-attempt fulfilment instead of
      // being swallowed as a duplicate.
      try {
        await payload.delete({
          collection: "processed-events",
          id: claimedEvent.id,
        });
      } catch (deleteError) {
        console.error("failed to un-claim processed-event after fulfilment error", deleteError, {
          eventId: event.id,
        });
      }
      return NextResponse.json({ error: "Internal error processing webhook." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
