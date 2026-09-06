import { createHash, randomBytes } from "node:crypto";

/**
 * The booking link is a bearer capability: whoever holds it sees the booking.
 * Only the hash is persisted, so a database dump yields no working links.
 * The page it unlocks is read-only by design — that, not the token, is what
 * makes a forwarded email survivable.
 */
export function hashBookingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateBookingToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashBookingToken(token) };
}
