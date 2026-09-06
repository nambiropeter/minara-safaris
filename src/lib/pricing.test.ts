import { describe, expect, it } from "vitest";

import { priceOrder, type PriceablePackage } from "@/lib/pricing";

const CATALOGUE: Record<string, PriceablePackage> = {
  "1": { id: 1, title: "7-day Masai Mara", priceFrom: 1250, currency: "USD" },
  "2": { id: 2, title: "Amboseli weekend", priceFrom: 400, currency: "USD" },
  "3": { id: 3, title: "Nakuru day trip", priceFrom: 9500, currency: "KES" },
};
const lookup = (refId: string) => CATALOGUE[refId];

describe("priceOrder", () => {
  it("computes subtotal and total from the catalogue, not the caller", () => {
    const result = priceOrder([{ kind: "package", refId: "1", quantity: 2 }], lookup);
    expect(result.amountTotal).toBe(250000); // 1250.00 USD x 2
    expect(result.currency).toBe("USD");
    expect(result.items[0].unitAmount).toBe(125000);
    expect(result.items[0].subtotal).toBe(250000);
    expect(result.items[0].title).toBe("7-day Masai Mara");
  });

  it("sums multiple items", () => {
    const result = priceOrder(
      [
        { kind: "package", refId: "1", quantity: 1 },
        { kind: "package", refId: "2", quantity: 3 },
      ],
      lookup,
    );
    expect(result.amountTotal).toBe(125000 + 120000);
  });

  it("rejects an unknown package rather than pricing it at zero", () => {
    expect(() =>
      priceOrder([{ kind: "package", refId: "999", quantity: 1 }], lookup),
    ).toThrow(/Unknown package/);
  });

  it("rejects mixed currencies", () => {
    expect(() =>
      priceOrder(
        [
          { kind: "package", refId: "1", quantity: 1 },
          { kind: "package", refId: "3", quantity: 1 },
        ],
        lookup,
      ),
    ).toThrow(/single currency/);
  });

  it("rejects an empty order", () => {
    expect(() => priceOrder([], lookup)).toThrow(/at least one item/);
  });

  it("rejects a non-positive quantity", () => {
    expect(() =>
      priceOrder([{ kind: "package", refId: "1", quantity: 0 }], lookup),
    ).toThrow(/quantity/);
  });
});
