import { describe, expect, it } from "vitest";

import { assertAmountMatches } from "@/lib/webhook-guards";

describe("assertAmountMatches", () => {
  it("accepts a session that matches the order", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: 250000, currency: "usd" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).not.toThrow();
  });

  it("rejects a short payment", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: 100, currency: "usd" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).toThrow(/amount mismatch/i);
  });

  it("rejects a currency swap", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: 250000, currency: "kes" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).toThrow(/currency mismatch/i);
  });

  it("rejects a missing amount rather than treating it as zero", () => {
    expect(() =>
      assertAmountMatches(
        { amount_total: null, currency: "usd" },
        { amountTotal: 250000, currency: "USD" },
      ),
    ).toThrow(/amount mismatch/i);
  });
});
