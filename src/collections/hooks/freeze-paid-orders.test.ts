import { describe, expect, it } from "vitest";

import { assertNotRepricingPaidOrder } from "@/collections/hooks/freeze-paid-orders";

describe("assertNotRepricingPaidOrder", () => {
  it("allows editing a pending order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "pending", amountTotal: 1000 },
        incoming: { amountTotal: 2000 },
      }),
    ).not.toThrow();
  });

  it("allows a status change on a paid order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1000 },
        incoming: {},
      }),
    ).not.toThrow();
  });

  it("refuses to change the total of a paid order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1000 },
        incoming: { amountTotal: 5 },
      }),
    ).toThrow(/already been paid/i);
  });

  it("refuses to change the items of a paid order", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1000 },
        incoming: { items: [{ title: "swapped" }] },
      }),
    ).toThrow(/already been paid/i);
  });

  it("treats a brand new order as editable", () => {
    expect(() =>
      assertNotRepricingPaidOrder({ previous: null, incoming: { amountTotal: 1000 } }),
    ).not.toThrow();
  });

  it("allows a status change even when Payload resends the full merged document", () => {
    // Payload's beforeChange hook receives the whole merged doc as `data` on
    // an update, not a sparse patch — currency and items are present on
    // every save whether or not they changed. Only an actual mismatch
    // against `previous` should count as repricing.
    const items = [
      { id: "abc", kind: "package", refId: "18", title: "A Weekend in Nakuru", unitAmount: 2400000, quantity: 1, subtotal: 2400000 },
    ];
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 2400000, currency: "KES", items },
        incoming: { amountTotal: 2400000, currency: "KES", items },
      }),
    ).not.toThrow();
  });
});
