import { Resend } from "resend";

import type { Order } from "@/payload-types";
import { formatMoney, type Currency } from "./money";

/**
 * Booking confirmation email with a link to the private booking page.
 * No-ops until RESEND_API_KEY, RESEND_FROM_EMAIL and NEXT_PUBLIC_SITE_URL
 * are all configured, same pattern as `notifyLead`.
 */
export async function notifyOrderPaid(order: Order, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !site) return;

  const resend = new Resend(apiKey);
  const total = formatMoney(order.amountTotal, order.currency as Currency);

  await resend.emails.send({
    from,
    to: order.customerEmail,
    subject: `Booking confirmed - ${order.orderNumber}`,
    text: [
      `Thank you. Your booking is confirmed.`,
      ``,
      `Booking reference: ${order.orderNumber}`,
      `Total paid: ${total}`,
      ``,
      `View your booking and download your invoice:`,
      `${site}/booking/${token}`,
      ``,
      `Keep this link — it is private to you and does not expire.`,
    ].join("\n"),
  });
}
