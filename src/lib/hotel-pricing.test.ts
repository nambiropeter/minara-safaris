import { afterEach, describe, expect, it, vi } from "vitest";

import { applyMargin, describeCancellation, eurToDisplay, marginBpsFromEnv, sellPrice } from "./hotel-pricing";

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

describe("eurToDisplay", () => {
  // 1 EUR = 150 KES = 1.16 USD
  const rates = { usdPerKes: 0.0077333, eurPerKes: 1 / 150, updatedAt: "" };

  it("converts euro cents to whole shillings, rounding up", () => {
    expect(eurToDisplay(10_000, "KES", rates)).toBe(15_000_00); // EUR 100 = KES 15,000
    expect(eurToDisplay(10_001, "KES", rates)).toBe(15_002_00); // 15001.5 -> 15002
  });

  it("converts euro cents to dollar cents, rounding up", () => {
    expect(eurToDisplay(10_000, "USD", rates)).toBe(11_600);
  });

  it("does not gain a unit to float error", () => {
    expect(eurToDisplay(100, "KES", { usdPerKes: 0.01, eurPerKes: 0.01, updatedAt: "" })).toBe(100_00);
  });

  it("refuses to guess without a EUR rate", () => {
    expect(() => eurToDisplay(10_000, "KES", { usdPerKes: 0.0077, updatedAt: "" })).toThrow();
  });
});

describe("sellPrice and describeCancellation", () => {
  const ctx = { marginBps: 1500, currency: "KES" as const, rates: { usdPerKes: 0.0077, eurPerKes: 1 / 150, updatedAt: "" } };
  const now = Date.parse("2027-02-10T00:00:00Z");

  it("applies margin then FX", () => {
    expect(sellPrice(100, ctx)).toBe(1_725_000); // EUR 115 = KES 17,250
  });

  it("offers free cancellation only while the first fee is still in the future", () => {
    const open = describeCancellation([{ amount: 50, from: "2027-02-20T23:59:00+03:00" }], ctx, now);
    expect(open.freeCancellationUntil).toBe("2027-02-20T23:59:00+03:00");
    expect(open.policies[0].amount).toBe(sellPrice(50, ctx));
  });

  it("treats a fee that has already started as non-refundable", () => {
    const nrf = describeCancellation([{ amount: 100, from: "2027-02-01T23:59:00+03:00" }], ctx, now);
    expect(nrf.freeCancellationUntil).toBeNull();
  });

  it("carries the fee through margin so a non-refundable fee equals the price", () => {
    const nrf = describeCancellation([{ amount: 100, from: "2027-02-01T00:00:00Z" }], ctx, now);
    expect(nrf.policies[0].amount).toBe(sellPrice(100, ctx));
  });

  it("has no free window when there are no policies", () => {
    expect(describeCancellation([], ctx, now)).toEqual({ freeCancellationUntil: null, policies: [] });
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
