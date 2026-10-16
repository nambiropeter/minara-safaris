import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Anonymous visitor session for /api/hotels/*. Not a login: guest checkout is a
 * settled decision. It exists so the supplier-backed endpoints can't be hit cold
 * by a script that never loaded the page, and so rate limits have a stable key.
 *
 * Token = `${id}.${issuedAtMs}.${hmac}`, HMAC-SHA256 over `id.issuedAt`, keyed
 * from PAYLOAD_SECRET with a domain prefix. Stateless, so nothing to store.
 */
export const SESSION_COOKIE = "hotel_session";
export const SESSION_TTL_MS = 30 * 60 * 1000;

function key(): string {
  const secret = process.env.PAYLOAD_SECRET;
  if (secret) return `hotel-session:${secret}`;
  if (process.env.NODE_ENV === "production") throw new Error("PAYLOAD_SECRET is required");
  return "hotel-session:dev-only-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function issueSession(now = Date.now()): string {
  const payload = `${randomBytes(12).toString("base64url")}.${now}`;
  return `${payload}.${sign(payload)}`;
}

export type VerifiedSession = { id: string; issuedAt: number };

export function verifySession(token: string | undefined, now = Date.now()): VerifiedSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, issued, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${issued}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || issuedAt > now || now - issuedAt > SESSION_TTL_MS) return null;
  return { id, issuedAt };
}
