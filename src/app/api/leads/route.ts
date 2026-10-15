import { NextResponse } from "next/server";
import { getPayload } from "payload";
import { z } from "zod";

import configPromise from "@payload-config";
import { allowRequest } from "@/lib/rate-limit";
import { notifyLead } from "@/lib/notify-lead";

const MIN_SUBMIT_MS = 3000;

const leadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().trim(),
  phone: z.string().trim().max(50).optional(),
  package: z.coerce.number().int().positive().optional(),
  travelDates: z.string().trim().max(200).optional(),
  travellers: z.coerce.number().int().min(1).max(50).optional(),
  message: z.string().trim().max(4000).optional(),
  /** ms the visitor spent on the form, measured on their own clock so clock drift can't fake a bot. */
  elapsedMs: z.coerce.number(),
  /** Honeypot. Named to look unremarkable so browsers and password managers don't autofill it. */
  contactRef: z.string().optional(),
  source: z.string().max(300).optional(),
  referrer: z.string().max(500).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
});

/** The only hand-written public write endpoint (PRD §7). Trust boundary: validate everything. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot + minimum time-to-submit. Reply success so bots don't learn to adapt,
  // but log the reason: a real visitor caught here sees "thanks" and loses their enquiry.
  const dropReason = data.contactRef ? "honeypot" : data.elapsedMs < MIN_SUBMIT_MS ? "too-fast" : null;
  if (dropReason) {
    console.warn("lead dropped by spam check", { reason: dropReason, elapsedMs: data.elapsedMs });
    return NextResponse.json({ ok: true });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const payload = await getPayload({ config: configPromise });
  const lead = await payload.create({
    collection: "leads",
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      package: data.package,
      travelDates: data.travelDates,
      travellers: data.travellers,
      message: data.message,
      source: data.source,
      referrer: data.referrer,
      utm: {
        source: data.utmSource,
        medium: data.utmMedium,
        campaign: data.utmCampaign,
      },
    },
  });

  await notifyLead(lead).catch(() => {});

  return NextResponse.json({ ok: true });
}
