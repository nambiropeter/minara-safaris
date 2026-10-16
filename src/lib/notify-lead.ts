import type { Lead } from "@/payload-types";

/**
 * Emails the team about a new enquiry by forwarding it to Formspree, which
 * delivers to the inbox configured on the form in Formspree's dashboard.
 * The lead is already saved in Payload before this runs, so a Formspree
 * outage loses the email, never the enquiry.
 *
 * Server-side on purpose: the browser posts to our own `/api/leads` (honeypot,
 * rate limit, time-to-submit), so Formspree only ever sees vetted leads.
 * No-ops until FORMSPREE_FORM_ID is set.
 */
export async function notifyLead(lead: Lead): Promise<void> {
  const formId = process.env.FORMSPREE_FORM_ID;
  if (!formId) return;

  const packageTitle =
    lead.package && typeof lead.package === "object" ? lead.package.title : undefined;

  const res = await fetch(`https://formspree.io/f/${formId}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      // Formspree sets Reply-To from `email`, so replying answers the traveller.
      email: lead.email,
      _subject: `New enquiry: ${lead.name}${packageTitle ? ` (${packageTitle})` : ""}`,
      name: lead.name,
      phone: lead.phone ?? undefined,
      package: packageTitle,
      travelDates: lead.travelDates ?? undefined,
      travellers: lead.travellers ?? undefined,
      message: lead.message ?? undefined,
      source: lead.source ?? undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(`Formspree rejected lead ${lead.id}: ${res.status} ${await res.text()}`);
  }
}
