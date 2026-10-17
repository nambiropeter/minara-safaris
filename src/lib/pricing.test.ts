import { describe, expect, it } from "vitest";

import { addHotel, priceOrder, type PriceablePackage } from "@/lib/pricing";

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

describe("addHotel", () => {
  const hotel = { refId: "42", title: "The Boma, Superior, room only, 3 nights", amount: 4886200, currency: "KES" as const };

  it("appends the hotel as its own item and totals both", () => {
    const pkg = priceOrder([{ kind: "package", refId: "3", quantity: 2 }], lookup);
    const bundle = addHotel(pkg, hotel);
    expect(bundle.items.map((i) => i.kind)).toEqual(["package", "hotel"]);
    expect(bundle.items[1]).toMatchObject({ unitAmount: 4886200, quantity: 1, subtotal: 4886200 });
    expect(bundle.amountTotal).toBe(2 * 950000 + 4886200);
    expect(pkg.items).toHaveLength(1); // the input is not mutated
  });

  it("refuses a hotel in a different currency than the package", () => {
    const pkg = priceOrder([{ kind: "package", refId: "1", quantity: 1 }], lookup);
    expect(() => addHotel(pkg, hotel)).toThrow(/single currency/);
  });
});
