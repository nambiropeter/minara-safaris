/**
 * ponytail: in-memory per-process — resets on redeploy and doesn't share
 * across serverless instances. Fine for the volume a lead form gets; move to
 * Upstash/Redis if abuse outgrows a single box.
 */
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 5;

const hits = new Map<string, number[]>();

export function allowRequest(
  key: string,
  options: { maxRequests?: number; windowMs?: number } = {},
): boolean {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;

  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= maxRequests) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
