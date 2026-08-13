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
  startedAt: z.coerce.number(),
  website: z.string().optional(),
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

  // Honeypot + minimum time-to-submit. Reply success so bots don't learn to adapt.
  if (data.website || Date.now() - data.startedAt < MIN_SUBMIT_MS) {
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
