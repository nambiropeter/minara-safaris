import { describe, expect, it } from "vitest";

import { orderParts } from "./order-parts";

describe("orderParts", () => {
  it("a hotel alone is not a bundle, and its whole subtotal is the hotel's", () => {
    expect(orderParts({ items: [{ kind: "hotel", subtotal: 4886200 }] })).toEqual({ bundle: false, hotelSubtotal: 4886200 });
  });

  it("a package alone is not a bundle and has no hotel part", () => {
    expect(orderParts({ items: [{ kind: "package", subtotal: 5800000 }] })).toEqual({ bundle: false, hotelSubtotal: 0 });
  });

  it("package plus hotel is a bundle; only the hotel item counts as the hotel's part", () => {
    expect(orderParts({ items: [{ kind: "package", subtotal: 1800000 }, { kind: "hotel", subtotal: 4886200 }] })).toEqual({
      bundle: true,
      hotelSubtotal: 4886200,
    });
  });
});
