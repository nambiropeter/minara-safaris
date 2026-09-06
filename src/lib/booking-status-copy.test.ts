import { describe, expect, it } from "vitest";

import { bookingStatusCopy } from "@/lib/booking-status-copy";

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
