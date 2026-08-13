import { Resend } from "resend";

import type { Lead } from "@/payload-types";

/**
 * Staff notification inbox and sender are unconfirmed (PRODUCT.md) — set
 * RESEND_API_KEY, RESEND_FROM_EMAIL and LEADS_NOTIFICATION_EMAIL to enable.
 * No-ops until all three exist, same pattern as `whatsappHref`.
 */
export async function notifyLead(lead: Lead): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.LEADS_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: `New enquiry: ${lead.name}`,
    text: [
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      lead.phone && `Phone: ${lead.phone}`,
      lead.travelDates && `Travel dates: ${lead.travelDates}`,
      lead.travellers && `Travellers: ${lead.travellers}`,
      lead.message && `Message: ${lead.message}`,
      lead.source && `Source: ${lead.source}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
