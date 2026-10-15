import { describe, expect, it } from "vitest";

import { bookingStatusCopy, hasReceipt } from "@/lib/booking-status-copy";

describe("bookingStatusCopy", () => {
  it("only claims 'Total paid' for paid/confirmed orders", () => {
    expect(bookingStatusCopy("paid").totalLabel).toBe("Total paid");
    expect(bookingStatusCopy("confirmed").totalLabel).toBe("Total paid");
  });

  it("never implies a failed/cancelled/refunded/pending order is paid", () => {
    for (const status of ["pending", "failed", "cancelled", "refunded"] as const) {
      const copy = bookingStatusCopy(status);
      expect(copy.totalLabel).not.toBe("Total paid");
      expect(copy.heading).not.toBe("Your booking");
    }
  });

  it("gives the happy path an empty body and the unhappy paths a distinct message", () => {
    expect(bookingStatusCopy("paid").body).toBeNull();
    expect(bookingStatusCopy("failed").heading).toMatch(/problem/i);
    expect(bookingStatusCopy("cancelled").body).toMatch(/no longer active/i);
    expect(bookingStatusCopy("refunded").body).toMatch(/no longer active/i);
  });
});

describe("hasReceipt", () => {
  it("is true once money has been taken, including after staff confirm", () => {
    expect(hasReceipt("paid")).toBe(true);
    expect(hasReceipt("confirmed")).toBe(true);
    expect(hasReceipt("refunded")).toBe(true);
  });

  it("is false when nothing was charged", () => {
    expect(hasReceipt("pending")).toBe(false);
    expect(hasReceipt("failed")).toBe(false);
    expect(hasReceipt("cancelled")).toBe(false);
  });
});
