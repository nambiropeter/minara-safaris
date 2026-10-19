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

describe("assertNotRepricingPaidOrder: hotel supplier figures", () => {
  const supplier = {
    netAmount: 338.28,
    marginBps: 1500,
    fxEurPerKes: 0.0066,
    fxUsdPerKes: 0.0077,
    cancellationPolicies: [{ from: "2027-01-13T12:00:00+03:00", amount: 5_000_000 }],
  };
  const paid = { status: "paid", amountTotal: 5_000_000, currency: "KES", items: [], supplier };

  it("refuses to change what the hotel price was built from once paid", () => {
    for (const change of [
      { netAmount: 1 },
      { marginBps: 0 },
      { fxEurPerKes: 0.01 },
      { fxUsdPerKes: 0.01 },
      { cancellationPolicies: [{ from: "2027-01-13T12:00:00+03:00", amount: 1 }] },
    ]) {
      expect(() =>
        assertNotRepricingPaidOrder({ previous: paid, incoming: { supplier: { ...supplier, ...change } } }),
      ).toThrow(/already been paid/);
    }
  });

  it("lets the server record the booking outcome after payment", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: paid,
        incoming: { supplier: { ...supplier, status: "booked", reference: "286-264500", note: "ok" } as never },
      }),
    ).not.toThrow();
  });

  it("lets the webhook record the outcome even when Payload passes only the changed group", () => {
    expect(() =>
      assertNotRepricingPaidOrder({ previous: paid, incoming: { supplier: { status: "booked", reference: "286-264500" } as never } }),
    ).not.toThrow();
  });

  it("still catches a money change that arrives alone in a partial group", () => {
    expect(() => assertNotRepricingPaidOrder({ previous: paid, incoming: { supplier: { marginBps: 0 } } })).toThrow(/already been paid/);
  });

  it("is not fooled by per-row ids or nulls Payload adds when it merges the document", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { ...paid, supplier: { ...supplier, cancellationPolicies: [{ id: "a", from: "2027-01-13T12:00:00+03:00", amount: 5_000_000 } as never] } },
        incoming: { supplier: { ...supplier, bookedNetAmount: null } as never },
      }),
    ).not.toThrow();
  });

  it("reads a cancellation date as a moment, not as text: the admin form sends the same instant back in UTC", () => {
    const saved = { ...paid, supplier: { ...supplier, cancellationPolicies: [{ from: "2026-10-21T23:59:00+03:00", amount: 1_997_400 }] } };
    const sameInstant = [{ from: "2026-10-21T20:59:00.000Z", amount: 1_997_400 }];
    expect(() => assertNotRepricingPaidOrder({ previous: saved, incoming: { supplier: { ...supplier, cancellationPolicies: sameInstant } } })).not.toThrow();

    const laterInstant = [{ from: "2026-10-22T20:59:00.000Z", amount: 1_997_400 }];
    expect(() => assertNotRepricingPaidOrder({ previous: saved, incoming: { supplier: { ...supplier, cancellationPolicies: laterInstant } } })).toThrow(/already been paid/);
  });

  it("leaves a package order alone when its empty supplier group is merged back as nulls", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "paid", amountTotal: 1, currency: "KES", items: [], supplier: null },
        incoming: { supplier: { netAmount: null, cancellationPolicies: [] } },
      }),
    ).not.toThrow();
  });

  it("lets the figures be set while the order is still pending", () => {
    expect(() =>
      assertNotRepricingPaidOrder({
        previous: { status: "pending", amountTotal: 1, currency: "KES", items: [], supplier: null },
        incoming: { supplier },
      }),
    ).not.toThrow();
  });
});
