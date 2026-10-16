import { afterEach, describe, expect, it, vi } from "vitest";

import { allowRequest } from "@/lib/rate-limit";

/** Fresh key per test — the limiter's map is module-level and shared. */
const key = (name: string) => `${name}-${Math.random()}`;

describe("allowRequest", () => {
  afterEach(() => vi.useRealTimers());

  it("allows the first five requests for a key", () => {
    const k = key("under-limit");
    for (let i = 1; i <= 5; i++) {
      expect(allowRequest(k), `request ${i}`).toBe(true);
    }
  });

  it("blocks the sixth request for a key", () => {
    const k = key("over-limit");
    for (let i = 0; i < 5; i++) allowRequest(k);
    expect(allowRequest(k)).toBe(false);
  });

  it("tracks each key independently", () => {
    const a = key("a");
    const b = key("b");
    for (let i = 0; i < 5; i++) allowRequest(a);
    expect(allowRequest(a)).toBe(false);
    expect(allowRequest(b)).toBe(true);
  });

  it("honours a custom maxRequests", () => {
    const k = key("custom");
    const opts = { maxRequests: 2 };
    expect(allowRequest(k, opts)).toBe(true);
    expect(allowRequest(k, opts)).toBe(true);
    expect(allowRequest(k, opts)).toBe(false);
  });

  it("honours a custom windowMs", () => {
    // Fake clock: a real 1ms window let the second call slip into the next
    // millisecond under load and flake.
    vi.useFakeTimers();
    const k = key("window");
    const opts = { maxRequests: 1, windowMs: 1000 };
    expect(allowRequest(k, opts)).toBe(true);
    expect(allowRequest(k, opts)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(allowRequest(k, opts)).toBe(true);
  });
});
