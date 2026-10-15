import { NextResponse } from "next/server";

import { hasReceipt } from "@/lib/booking-status-copy";
import { findOrderByToken } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe hosts the receipt (with its own PDF download). This route only
 * decides who gets the link: whoever holds the booking token.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await findOrderByToken(token);

  // 404 rather than 403 so the route never confirms a booking exists.
  if (!order || !hasReceipt(order.status) || !order.stripe?.paymentIntentId) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return new NextResponse("Service Unavailable", { status: 503 });
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(order.stripe.paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (!charge?.receipt_url) {
      return new NextResponse("Receipt not found", { status: 404 });
    }
    return NextResponse.redirect(charge.receipt_url, 303);
  } catch (error) {
    console.error("Failed to retrieve receipt", error, { orderId: order.id });
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
