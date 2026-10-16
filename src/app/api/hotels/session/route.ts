import { NextResponse } from "next/server";

import { issueSession, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/hotel-session";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Issues the anonymous session cookie the other /api/hotels routes require. Cookies
 * can't be set while a server component renders, so the search form calls this on
 * mount. It never touches Hotelbeds, so it costs no look-to-book budget.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowRequest(`hotel-session:${ip}`, { maxRequests: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, issueSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/hotels",
    maxAge: SESSION_TTL_MS / 1000,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
