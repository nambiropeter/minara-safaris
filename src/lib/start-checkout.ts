import type { Payload } from "payload";
import type Stripe from "stripe";

import type { Order } from "@/payload-types";
import { generateBookingToken } from "./booking-token";

type NewOrder = Omit<Order, "id" | "createdAt" | "updatedAt" | "orderNumber" | "status" | "accessTokenHash">;

/**
 * The one place an order and its Stripe Checkout session are created together, shared by
 * the package checkout and the hotel booking so the money path exists once.
 *
 * The caller has already priced everything on the server; nothing here accepts a price
 * from a browser. A session that can't be created leaves a `failed` order as an audit
 * trail, never a live `pending` one.
 */
export async function startCheckout(args: {
  payload: Payload;
  stripe: Stripe;
  origin: string;
  /** Where Stripe sends the customer who backs out, e.g. `/packages`. */
  cancelPath: string;
  order: NewOrder;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
}): Promise<{ ok: true; url: string | null } | { ok: false }> {
  const { payload, stripe, origin, cancelPath, order: data, lineItems } = args;

  const { token, hash } = generateBookingToken();
  const orderNumber = `MS-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

  const order = await payload.create({
    collection: "orders",
    data: { ...data, orderNumber, status: "pending", accessTokenHash: hash },
  });

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: data.customerEmail,
      client_reference_id: String(order.id),
      metadata: { orderId: String(order.id), bookingToken: token },
      line_items: lineItems,
      success_url: `${origin}/booking/${token}?paid=1`,
      cancel_url: `${origin}${cancelPath}`,
    });
  } catch (error) {
    console.error("stripe checkout session failed", error, { orderId: order.id });
    // Kept as an audit trail, but never left as a live "pending" order.
    await payload.update({
      collection: "orders",
      id: order.id,
      data: { status: "failed", staffNotes: "Stripe session could not be created." },
    });
    return { ok: false };
  }

  await payload.update({
    collection: "orders",
    id: order.id,
    data: { stripe: { checkoutSessionId: session.id } },
  });

  return { ok: true, url: session.url };
}
