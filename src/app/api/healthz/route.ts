import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Liveness: the process is up and can answer. It deliberately touches nothing else,
 * so a database or supplier outage can't make an orchestrator restart a healthy app.
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
