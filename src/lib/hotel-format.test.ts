import { describe, expect, it } from "vitest";

import { cancellationLines, formatHotelMoney, nightsLabel, storedCancellation } from "./hotel-format";

describe("formatHotelMoney", () => {
  it("drops .00 from whole amounts and keeps real cents", () => {
    expect(formatHotelMoney(1_725_000, "KES")).toBe("KES 17,250");
    expect(formatHotelMoney(11_520, "USD")).toBe("USD 115.20");
  });
});

describe("nightsLabel", () => {
  it("pluralises", () => {
    expect(nightsLabel(1)).toBe("1 night");
    expect(nightsLabel(3)).toBe("3 nights");
  });
});

describe("cancellationLines", () => {
  const price = 1_725_000;

  it("states a free window and the fees after it", () => {
    const lines = cancellationLines(
      { freeCancellationUntil: "2027-02-20T23:59:00+03:00", policies: [{ from: "2027-02-20T23:59:00+03:00", amount: 862_500 }] },
      "KES",
      price,
    );
    expect(lines[0]).toBe("Free cancellation until 20 Feb 2027");
    expect(lines[1]).toBe("From 20 Feb 2027: KES 8,625 fee");
  });

  it("says non-refundable when the fee is the whole price and already running", () => {
    expect(cancellationLines({ freeCancellationUntil: null, policies: [{ from: "2020-01-01T00:00:00Z", amount: price }] }, "KES", price)).toEqual([
      "Non-refundable",
    ]);
  });

  it("does not call a part-fee non-refundable", () => {
    const lines = cancellationLines({ freeCancellationUntil: null, policies: [{ from: "2020-01-01T00:00:00Z", amount: 500_000 }] }, "KES", price);
    expect(lines[0]).toBe("No free cancellation");
    expect(lines[1]).toContain("KES 5,000 fee");
  });

  it("is non-refundable when there are no policies to read", () => {
    expect(cancellationLines({ freeCancellationUntil: null, policies: [] }, "KES", price)).toEqual(["Non-refundable"]);
  });
});

describe("storedCancellation", () => {
  const now = Date.parse("2027-02-10T00:00:00Z");

  it("is free while the first fee is still ahead", () => {
    const c = storedCancellation([{ from: "2027-02-20T23:59:00+03:00", amount: 500 }], now);
    expect(c.freeCancellationUntil).toBe("2027-02-20T23:59:00+03:00");
  });

  it("is not free once the first fee has started, or when there are no terms", () => {
    expect(storedCancellation([{ from: "2027-02-01T00:00:00Z", amount: 500 }], now).freeCancellationUntil).toBeNull();
    expect(storedCancellation([], now).freeCancellationUntil).toBeNull();
  });
});
