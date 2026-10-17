import { NextResponse } from "next/server";
import { getPayload, type Payload } from "payload";
import type Stripe from "stripe";
import { z } from "zod";

import configPromise from "@payload-config";
import { bookRoom, getHotelbeds } from "@/lib/hotelbeds";
import { formatMoney, type Currency } from "@/lib/money";
import { orderParts } from "@/lib/order-parts";
import { notifyHotelRefused, notifyOrderPaid, notifyStaff } from "@/lib/notify-order";
import { refundPayment } from "@/lib/refund";
import { getStripe } from "@/lib/stripe";
import { assertAmountMatches } from "@/lib/webhook-guards";
import type { Order } from "@/payload-types";

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
    await handleEvent(payload, stripe, event);
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

async function handleEvent(payload: Payload, stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      // Delayed methods (Bacs, SEPA) complete "unpaid" and settle later via
      // async_payment_succeeded, which lands here too.
      if (event.data.object.payment_status === "paid") {
        await fulfil(payload, stripe, event.data.object);
      }
      return;
    case "checkout.session.async_payment_failed":
      await settlePending(payload, event.data.object, "failed", "Delayed payment failed.");
      return;
    case "checkout.session.expired":
      await settlePending(payload, event.data.object, "cancelled", "Checkout expired unpaid.");
      return;
    case "charge.refunded":
      await recordRefund(payload, event.data.object);
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

async function fulfil(payload: Payload, stripe: Stripe, session: Stripe.Checkout.Session): Promise<void> {
  const order = await findSessionOrder(payload, session);
  if (!order || order.status === "paid" || order.status === "confirmed") return;
  // Cancelled, failed or refunded: staff or an earlier event closed this order,
  // so money arriving now must not reopen it. Only a human can refund.
  if (order.status !== "pending") {
    await notifyStaff(
      `Payment on inactive order - ${order.orderNumber}`,
      `Session ${session.id} paid an order that is ${order.status}. Refund it in Stripe.`,
    ).catch((e) => console.error("staff alert failed", e));
    return;
  }

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

  const bookingToken = session.metadata?.bookingToken;

  // A hotel is only a booking once the supplier says so. Payment is recorded first, and
  // the outcome of the supplier call lands on the order whatever it is. It must never
  // throw: Stripe's retry would meet an already-paid order and never try again.
  if (updated.supplier?.name === "hotelbeds") {
    await fulfilHotel(payload, stripe, updated, bookingToken).catch((error) =>
      console.error("hotel fulfilment failed unexpectedly", error, { orderId: order.id }),
    );
    return;
  }

  // A failed send must never fail the webhook: the retry would be swallowed
  // as a duplicate without ever attempting the email again.
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

const guestsSchema = z
  .array(
    z.object({
      type: z.enum(["AD", "CH"]),
      name: z.string().min(1),
      surname: z.string().min(1),
      age: z.number().int().optional(),
    }),
  )
  .min(1);

const alertStaff = (subject: string, text: string) =>
  notifyStaff(subject, text).catch((e) => console.error("staff alert failed", e));

/** Merges a patch into the order's hotel group (and any top-level fields) and returns the saved order. */
function recordSupplier(
  payload: Payload,
  order: Order,
  supplier: NonNullable<Order["supplier"]>,
  top: { status?: Order["status"] } = {},
) {
  return payload.update({ collection: "orders", id: order.id, data: { ...top, supplier } });
}

/**
 * Books the hotel once the money has arrived. Three honest outcomes, and the rule that
 * matters: only a definite refusal is refunded. If we can't tell whether Hotelbeds booked
 * (its sandbox answered a real cancellation with a 500 that had in fact worked), refunding
 * could leave a live booking nobody paid for, and retrying could book twice. So that case
 * stops here, loudly, for a human to check against our reference.
 */
async function fulfilHotel(payload: Payload, stripe: Stripe, order: Order, bookingToken: string | undefined): Promise<void> {
  const supplier = order.supplier;
  const config = getHotelbeds();
  const guests = guestsSchema.safeParse(supplier?.guests);

  if (!supplier?.rateKey || !config || !guests.success) {
    await recordSupplier(payload, order, { status: "unknown", note: "Paid, but the booking could not be started: the rate, guest list or Hotelbeds credentials are missing." });
    await alertStaff(
      `URGENT: hotel not booked - ${order.orderNumber}`,
      `The customer has paid but the hotel booking could not be started. Nothing was sent to Hotelbeds.\nCustomer: ${order.customerEmail}`,
    );
    return;
  }

  // Written before the call, so if this process dies mid-booking the order says so and
  // carries the reference to search Hotelbeds for.
  try {
    await recordSupplier(payload, order, { status: "booking", clientReference: order.orderNumber });
  } catch (error) {
    console.error("could not record the booking attempt, not booking", error, { orderId: order.id });
    await alertStaff(`URGENT: hotel not booked - ${order.orderNumber}`, `Paid, but the order could not be updated so no booking was attempted. Book or refund by hand.\nCustomer: ${order.customerEmail}`);
    return;
  }

  // In a bundle the package still needs staff, so the hotel booking never confirms the order.
  const { bundle, hotelSubtotal } = orderParts(order);

  const holder = guests.data[0];
  const result = await bookRoom(config, {
    clientReference: order.orderNumber,
    rateKey: supplier.rateKey,
    holder: { name: holder.name, surname: holder.surname },
    guests: guests.data,
  });

  if (result.outcome === "booked") {
    const { booking } = result;
    const quoted = supplier.netAmount ?? 0;
    const confirmed = await recordSupplier(
      payload,
      order,
      {
        status: "booked",
        reference: booking.reference,
        clientReference: booking.clientReference || order.orderNumber,
        bookedNetAmount: booking.totalNet,
        payableTo: [booking.supplierName, booking.supplierVat && `VAT ${booking.supplierVat}`].filter(Boolean).join(", "),
        ...(booking.totalNet > quoted + 0.005 && {
          note: `Booked at EUR ${booking.totalNet}, above the EUR ${quoted} quoted. Margin is lower than planned.`,
        }),
      },
      bundle ? {} : { status: "confirmed" },
    );
    if (bookingToken) {
      await notifyOrderPaid(confirmed, bookingToken).catch((e) =>
        console.error("booking confirmation email failed", e, { orderId: order.id }),
      );
    }
    await alertStaff(
      `${bundle ? "Hotel booked, package needs confirming" : "New hotel booking"} - ${order.orderNumber}`,
      [
        `${order.customerName ?? ""} <${order.customerEmail}>`,
        `Hotelbeds reference: ${booking.reference}`,
        `Total: ${formatMoney(order.amountTotal, order.currency as Currency)}`,
        ...order.items.map((i) => i.title),
      ].join("\n"),
    );
    return;
  }

  if (result.outcome === "rejected") {
    // Recorded BEFORE the refund. The refund triggers `charge.refunded`, whose handler rewrites
    // this order from its own earlier read within a second; anything we saved after the refund
    // would be overwritten by that stale copy (seen live 2026-10-17: status stuck on "booking").
    await recordSupplier(payload, order, {
      status: "failed",
      note: `Hotelbeds did not book this: ${result.reason}. ${bundle ? `The hotel part (${formatMoney(hotelSubtotal, order.currency as Currency)}) is being refunded automatically; the package stands and still needs confirming.` : "Refunding automatically."}`,
    });

    const paymentIntentId = order.stripe?.paymentIntentId;
    const refund = paymentIntentId
      ? await refundPayment(stripe, {
          paymentIntentId,
          orderId: order.id,
          // A bundle's package stands, so only the hotel's part goes back.
          ...(bundle && { amount: hotelSubtotal }),
          // Not the staff button's key: a refund from either party must never be mistaken for the other's.
          idempotencyKey: `refund-order-${order.id}-auto${bundle ? "-hotel" : ""}`,
          requestedBy: "system: Hotelbeds refused the booking",
        })
      : ({ ok: false, reason: "failed", message: "no Stripe payment recorded" } as const);
    const refunded = refund.ok || refund.reason === "already_refunded";

    // A failed refund raises no `charge.refunded`, so nothing can overwrite this one.
    if (!refunded) {
      await recordSupplier(payload, order, {
        status: "failed",
        note: `Hotelbeds did not book this: ${result.reason}. AUTOMATIC REFUND FAILED: refund it by hand.`,
      });
    }
    await alertStaff(
      refunded ? `Hotel refused, customer refunded${bundle ? " (hotel part)" : ""} - ${order.orderNumber}` : `URGENT: hotel refused AND refund failed - ${order.orderNumber}`,
      `${result.reason}\nCustomer: ${order.customerEmail}`,
    );
    if (refunded) {
      await notifyHotelRefused(order).catch((e) => console.error("refund notice email failed", e, { orderId: order.id }));
    }
    return;
  }

  // Unknown: no refund, no retry. The customer is told what is true, that payment arrived
  // and the booking is being confirmed.
  await recordSupplier(payload, order, {
    status: "unknown",
    note: `Could not tell whether Hotelbeds booked this: ${result.reason}. Search Hotelbeds for ${order.orderNumber}.`,
  });
  await alertStaff(
    `URGENT: hotel booking unknown - ${order.orderNumber}`,
    [
      `We could not tell whether Hotelbeds booked this. Do NOT refund or rebook until you have checked.`,
      `Search Hotelbeds for client reference ${order.orderNumber}.`,
      `Customer: ${order.customerEmail}`,
      result.reason,
    ].join("\n"),
  );
  if (bookingToken) {
    await notifyOrderPaid(order, bookingToken).catch((e) =>
      console.error("booking confirmation email failed", e, { orderId: order.id }),
    );
  }
}

async function settlePending(
  payload: Payload,
  session: Stripe.Checkout.Session,
  status: "failed" | "cancelled",
  note: string,
): Promise<void> {
  const order = await findSessionOrder(payload, session);
  // Only an unsettled order moves. A late event must never undo a payment.
  if (!order || order.status !== "pending") return;
  await payload.update({
    collection: "orders",
    id: order.id,
    data: { status, staffNotes: appendNote(order.staffNotes, note) },
  });
}

async function recordRefund(payload: Payload, charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  // ponytail: unindexed lookup on stripe.paymentIntentId; index it if orders reach the tens of thousands.
  const {
    docs: [order],
  } = await payload.find({
    collection: "orders",
    where: { "stripe.paymentIntentId": { equals: paymentIntentId } },
    limit: 1,
    depth: 0,
  });
  if (!order) {
    console.error("refund for unknown order", { paymentIntentId });
    return;
  }

  const refunded = formatMoney(charge.amount_refunded, order.currency as Currency);
  // A partial refund keeps the booking live; staff decide what it means.
  const data = charge.refunded
    ? { status: "refunded" as const, staffNotes: appendNote(order.staffNotes, `Refunded in full: ${refunded}.`) }
    : { staffNotes: appendNote(order.staffNotes, `Partially refunded: ${refunded} so far.`) };

  await payload.update({ collection: "orders", id: order.id, data });
  await notifyStaff(
    `Refund - ${order.orderNumber}`,
    `${charge.refunded ? "Full" : "Partial"} refund recorded: ${refunded}.`,
  ).catch((e) => console.error("staff alert failed", e));
}

function appendNote(notes: string | null | undefined, line: string): string {
  return `${notes ?? ""}\n${line}`.trim();
}
