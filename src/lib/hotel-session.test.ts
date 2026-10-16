import { describe, expect, it } from "vitest";

import { issueSession, SESSION_TTL_MS, verifySession } from "./hotel-session";

describe("hotel session", () => {
  it("round-trips a freshly issued token", () => {
    const now = 1_000_000;
    const session = verifySession(issueSession(now), now + 5000);
    expect(session?.issuedAt).toBe(now);
    expect(session?.id).toBeTruthy();
  });

  it("rejects a missing, malformed or tampered token", () => {
    const token = issueSession(1_000_000);
    expect(verifySession(undefined, 1_000_001)).toBeNull();
    expect(verifySession("nonsense", 1_000_001)).toBeNull();
    const [id, issued, signature] = token.split(".");
    expect(verifySession(`${id}.${Number(issued) + 1}.${signature}`, 1_000_001)).toBeNull();
    expect(verifySession(`other.${issued}.${signature}`, 1_000_001)).toBeNull();
  });

  it("rejects an expired token and one issued in the future", () => {
    const now = 1_000_000;
    expect(verifySession(issueSession(now), now + SESSION_TTL_MS + 1)).toBeNull();
    expect(verifySession(issueSession(now + 10_000), now)).toBeNull();
  });

  it("gives each session its own id", () => {
    const a = verifySession(issueSession(1), 2);
    const b = verifySession(issueSession(1), 2);
    expect(a?.id).not.toBe(b?.id);
  });
});
