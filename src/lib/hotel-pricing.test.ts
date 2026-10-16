import { afterEach, describe, expect, it, vi } from "vitest";

import { applyMargin, marginBpsFromEnv } from "./hotel-pricing";

describe("applyMargin", () => {
  it("adds the margin in minor units", () => {
    expect(applyMargin(100, 1500)).toBe(11500);
  });

  it("rounds up so margin is never lost", () => {
    // 33.33 net = 3333 minor; +15% = 3832.95 -> 3833
    expect(applyMargin(33.33, 1500)).toBe(3833);
  });

  it("is exact for zero margin", () => {
    expect(applyMargin(19.99, 0)).toBe(1999);
  });

  it("rejects a bad net price or margin", () => {
    expect(() => applyMargin(-1, 1000)).toThrow();
    expect(() => applyMargin(Number.NaN, 1000)).toThrow();
    expect(() => applyMargin(10, 12.5)).toThrow();
    expect(() => applyMargin(10, -1)).toThrow();
  });
});

describe("marginBpsFromEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads basis points", () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "1200");
    expect(marginBpsFromEnv()).toBe(1200);
  });

  it("throws when unset or malformed rather than defaulting to zero margin", () => {
    vi.stubEnv("HOTEL_MARGIN_BPS", "");
    expect(() => marginBpsFromEnv()).toThrow();
    vi.stubEnv("HOTEL_MARGIN_BPS", "12%");
    expect(() => marginBpsFromEnv()).toThrow();
  });
});
