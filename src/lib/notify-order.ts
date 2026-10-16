import { Resend } from "resend";

import type { Order } from "@/payload-types";
import { formatMoney, type Currency } from "./money";

/**
 * Booking confirmation email with a link to the private booking page, and the
 * invoice PDF attached when Stripe has one ready. The link stays in the body
 * either way, so a missing attachment never leaves the customer without it.
 * No-ops until RESEND_API_KEY, RESEND_FROM_EMAIL and NEXT_PUBLIC_SITE_URL
 * are all configured, same pattern as `notifyLead`.
 */
export async function notifyOrderPaid(
  order: Order,
  token: string,
  invoicePdf?: Buffer | null,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !site) return;

  const resend = new Resend(apiKey);
  const total = formatMoney(order.amountTotal, order.currency as Currency);
  // A hotel booked straight away is confirmed by the supplier, not "being confirmed".
  const confirmed = order.status === "confirmed";
  const hotelReference = order.supplier?.reference;

  await resend.emails.send({
    from,
    to: order.customerEmail,
    subject: confirmed ? `Booking confirmed - ${order.orderNumber}` : `Payment received - ${order.orderNumber}`,
    text: [
      confirmed
        ? `Thank you. Your booking is confirmed.`
        : `Thank you, we have received your payment. We are now confirming availability with our partners for your dates, and will be in touch to confirm your booking.`,
      ``,
      `Booking reference: ${order.orderNumber}`,
      ...(hotelReference ? [`Hotel confirmation number: ${hotelReference}`] : []),
      `Total paid: ${total}`,
      ``,
      `View your booking and payment receipt:`,
      `${site}/booking/${token}`,
      ``,
      `Keep this link — it is private to you and does not expire.`,
      ...(invoicePdf ? [``, `Your invoice is attached.`] : []),
    ].join("\n"),
    attachments: invoicePdf
      ? [{ filename: `Invoice-${order.orderNumber}.pdf`, content: invoicePdf }]
      : undefined,
  });
}

/**
 * Tells a customer who has already paid that the hotel could not be booked and the money
 * is on its way back. Without it they would hear nothing between a charge and a refund.
 */
export async function notifyHotelRefused(order: Order): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;

  const total = formatMoney(order.amountTotal, order.currency as Currency);
  await new Resend(apiKey).emails.send({
    from,
    to: order.customerEmail,
    subject: `We could not confirm your hotel - ${order.orderNumber}`,
    text: [
      `We are sorry: the hotel could not confirm your booking, so nothing has been booked.`,
      ``,
      `We have refunded your payment of ${total} in full. It can take 5 to 10 working days to appear on your statement.`,
      ``,
      `Booking reference: ${order.orderNumber}`,
      ``,
      `If you would still like to stay, reply to this email and we will help you find another room.`,
    ].join("\n"),
  });
}

/**
 * Internal alert to the same inbox that receives enquiries. No-ops until
 * RESEND_API_KEY, RESEND_FROM_EMAIL and LEADS_NOTIFICATION_EMAIL are set.
 */
export async function notifyStaff(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.LEADS_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) return;

  await new Resend(apiKey).emails.send({ from, to, subject, text });
}
