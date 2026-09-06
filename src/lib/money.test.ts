import { describe, expect, it } from "vitest";

import { formatMoney, toMinorUnits } from "@/lib/money";

describe("toMinorUnits", () => {
  it("converts major units to integer minor units", () => {
    expect(toMinorUnits(1250, "KES")).toBe(125000);
    expect(toMinorUnits(99.99, "USD")).toBe(9999);
  });

  it("rounds half-up rather than truncating", () => {
    // Float drift must not silently lose a cent.
    expect(toMinorUnits(10.005, "USD")).toBe(1001);
  });

  it("rejects non-finite input rather than producing NaN", () => {
    expect(() => toMinorUnits(Number.NaN, "USD")).toThrow(/finite/);
    expect(() => toMinorUnits(Number.POSITIVE_INFINITY, "KES")).toThrow(/finite/);
  });

  it("rejects negative amounts", () => {
    expect(() => toMinorUnits(-1, "USD")).toThrow(/negative/);
  });
});

describe("formatMoney", () => {
  it("formats minor units back to a human string", () => {
    expect(formatMoney(125000, "KES")).toBe("KES 1,250.00");
    expect(formatMoney(9999, "USD")).toBe("USD 99.99");
  });
});
