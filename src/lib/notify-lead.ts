import { Resend } from "resend";

import type { Lead } from "@/payload-types";

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const cell = "padding:6px 0;vertical-align:top;";
const label = `${cell}padding-right:16px;color:#666;white-space:nowrap;`;

/**
 * Sends vetted leads through the configured notification provider. Formspree
 * is preferred when configured; Resend remains the fallback for deployments
 * that already have the staff inbox credentials.
 */
export async function notifyLead(lead: Lead): Promise<void> {
  const formId = process.env.FORMSPREE_FORM_ID;
  const packageTitle =
    lead.package && typeof lead.package === "object" ? lead.package.title : undefined;

  if (formId) {
    const res = await fetch(`https://formspree.io/f/${formId}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
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
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.LEADS_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !to) return;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const adminUrl = site ? `${site}/admin/collections/leads/${lead.id}` : null;
  const details: [string, string | null | undefined][] = [
    ["Package", packageTitle],
    ["Preferred dates", lead.travelDates],
    ["Travellers", lead.travellers != null ? String(lead.travellers) : null],
    ["Phone", lead.phone],
  ];
  const rows = details.filter((row): row is [string, string] => Boolean(row[1]));
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#1a1a1a;line-height:1.5">
<h2 style="margin:0 0 4px">New enquiry from ${esc(lead.name)}</h2>
<p style="margin:0 0 16px;color:#666">Hit Reply to answer them directly.</p>
<table style="border-collapse:collapse;width:100%">
<tr><td style="${label}">Email</td><td style="${cell}"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td></tr>
${rows.map(([name, value]) => `<tr><td style="${label}">${name}</td><td style="${cell}">${esc(value)}</td></tr>`).join("\n")}
</table>
${lead.message ? `<p style="margin:16px 0 4px;color:#666">Message</p><div style="white-space:pre-wrap;background:#f6f6f6;padding:12px;border-radius:6px">${esc(lead.message)}</div>` : ""}
${adminUrl ? `<p style="margin:20px 0 0"><a href="${esc(adminUrl)}">Open in the admin</a></p>` : ""}
</div>`;
  const text = [
    `New enquiry from ${lead.name}`,
    "",
    `Email: ${lead.email}`,
    ...rows.map(([name, value]) => `${name}: ${value}`),
    ...(lead.message ? ["", "Message:", lead.message] : []),
    ...(adminUrl ? ["", `Open in the admin: ${adminUrl}`] : []),
  ].join("\n");

  await new Resend(apiKey).emails.send({
    from,
    to,
    replyTo: lead.email,
    subject: `New enquiry: ${lead.name}`,
    html,
    text,
  });
}
