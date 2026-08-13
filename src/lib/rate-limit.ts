/**
 * ponytail: in-memory per-process — resets on redeploy and doesn't share
 * across serverless instances. Fine for the volume a lead form gets; move to
 * Upstash/Redis if abuse outgrows a single box.
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

const hits = new Map<string, number[]>();

export function allowRequest(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
