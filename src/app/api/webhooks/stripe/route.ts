import { NextResponse } from "next/server";
import { getPayload, type Payload } from "payload";
import type Stripe from "stripe";

import configPromise from "@payload-config";
import { formatMoney, type Currency } from "@/lib/money";
import { notifyOrderPaid, notifyStaff } from "@/lib/notify-order";
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

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const payload = await getPayload({ config: configPromise });

  let claimedEvent;
  try {
    claimedEvent = await payload.create({
      collection: "processed-events",
      data: { eventId: event.id, type: event.type },
    });
  } catch (error) {
    // Only a row that already exists makes this a retry. Anything else (a
    // dropped connection) must 500 so Stripe redelivers, or the payment is lost.
    const existing = await payload
      .find({
        collection: "processed-events",
        where: { eventId: { equals: event.id } },
        limit: 1,
        depth: 0,
      })
      .catch(() => null);
    if (existing?.docs.length) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("processed-events claim failed", error, { eventId: event.id });
    return NextResponse.json({ error: "Could not record event." }, { status: 500 });
  }

  try {
    await handleEvent(payload, event);
  } catch (error) {
    console.error("webhook handling failed after claiming event", error, { eventId: event.id });
    // Un-claim so a genuine retry can re-attempt instead of being swallowed
    // as a duplicate.
    try {
      await payload.delete({ collection: "processed-events", id: claimedEvent.id });
    } catch (deleteError) {
      console.error("failed to un-claim processed-event after handling error", deleteError, {
        eventId: event.id,
      });
    }
    return NextResponse.json({ error: "Internal error processing webhook." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(payload: Payload, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      // Delayed methods (Bacs, SEPA) complete "unpaid" and settle later.
      if (event.data.object.payment_status === "paid") {
        await fulfil(payload, event.data.object);
      }
      return;
  }
}

async function findSessionOrder(payload: Payload, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return null;
  const order = await payload.findByID({
    collection: "orders",
    id: orderId,
    depth: 0,
    disableErrors: true,
  });
  // A retry can't make a missing order appear, so log and acknowledge.
  if (!order) console.error("webhook for unknown order", { orderId, sessionId: session.id });
  return order;
}

async function fulfil(payload: Payload, session: Stripe.Checkout.Session): Promise<void> {
  const order = await findSessionOrder(payload, session);
  if (!order || order.status === "paid" || order.status === "confirmed") return;

  try {
    assertAmountMatches(
      { amount_total: session.amount_total, currency: session.currency },
      { amountTotal: order.amountTotal, currency: order.currency },
    );
  } catch (error) {
    const reason = (error as Error).message;
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { status: "failed", staffNotes: appendNote(order.staffNotes, `Payment refused: ${reason}`) },
    });
    await notifyStaff(
      `Payment refused - ${order.orderNumber}`,
      `${reason}\nStripe session: ${session.id}`,
    ).catch((e) => console.error("staff alert failed", e));
    return;
  }

  const updated = await payload.update({
    collection: "orders",
    id: order.id,
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

  // A failed send must never fail the webhook: the retry would be swallowed
  // as a duplicate without ever attempting the email again.
  const bookingToken = session.metadata?.bookingToken;
  if (bookingToken) {
    await notifyOrderPaid(updated, bookingToken).catch((e) =>
      console.error("booking confirmation email failed", e, { orderId: order.id }),
    );
  }
  await notifyStaff(
    `New paid booking - ${updated.orderNumber}`,
    [
      `${updated.customerName ?? ""} <${updated.customerEmail}>`,
      `Total: ${formatMoney(updated.amountTotal, updated.currency as Currency)}`,
      ...updated.items.map((i) => `${i.title} x${i.quantity}`),
    ].join("\n"),
  ).catch((e) => console.error("staff alert failed", e));
}

function appendNote(notes: string | null | undefined, line: string): string {
  return `${notes ?? ""}\n${line}`.trim();
}
