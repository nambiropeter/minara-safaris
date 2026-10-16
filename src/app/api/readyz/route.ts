import configPromise from "@payload-config";
import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getHotelbeds } from "@/lib/hotelbeds";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Readiness: can this instance serve traffic. The database is the one hard dependency,
 * so only it can fail the probe; Hotelbeds being unconfigured degrades hotel search but
 * not the site, so it is reported and not fatal.
 *
 * It never calls Hotelbeds. Every supplier request counts against look-to-book, and a
 * probe firing every few seconds would burn the account's ratio on nothing. It only says
 * whether the credentials are present.
 */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Public and it hits the database, so cap it; a real probe is far below this.
  if (!allowRequest(`readyz:${ip}`, { maxRequests: 60, windowMs: 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let database: "ok" | "failing" = "ok";
  try {
    const payload = await getPayload({ config: configPromise });
    await payload.count({ collection: "users" });
  } catch (error) {
    console.error("readyz: database check failed", error);
    database = "failing";
  }

  const ready = database === "ok";
  return NextResponse.json(
    { status: ready ? "ready" : "unavailable", checks: { database, hotelbeds: getHotelbeds() ? "configured" : "not configured" } },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
