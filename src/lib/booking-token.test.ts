import { describe, expect, it } from "vitest";

import { generateBookingToken, hashBookingToken } from "@/lib/booking-token";

describe("generateBookingToken", () => {
  it("is url-safe and long enough to be unguessable", () => {
    const { token } = generateBookingToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes base64url
  });

  it("does not repeat", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateBookingToken().token),
    );
    expect(seen.size).toBe(500);
  });
});

describe("hashBookingToken", () => {
  it("is deterministic and matches the generated hash", () => {
    const { token, hash } = generateBookingToken();
    expect(hashBookingToken(token)).toBe(hash);
  });

  it("does not reveal the token", () => {
    const { token, hash } = generateBookingToken();
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
