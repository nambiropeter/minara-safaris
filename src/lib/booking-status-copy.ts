import type { Order } from "@/payload-types";

/**
 * Copy shown on the booking page, keyed off order status. Kept as a pure
 * function so a `failed`/`cancelled`/`refunded` order can never render the
 * same "paid" copy as a genuinely settled one.
 */
export function bookingStatusCopy(status: Order["status"]): {
  heading: string;
  body: string | null;
  totalLabel: string;
} {
  switch (status) {
    case "pending":
      return {
        heading: "Confirming your payment",
        body: "We are waiting for your payment to confirm. This page updates once it does — refresh in a moment.",
        totalLabel: "Amount",
      };
    case "failed":
      return {
        heading: "There was a problem with your payment",
        body: "Your payment did not go through and this booking was not charged. Please get in touch or try again.",
        totalLabel: "Amount",
      };
    case "cancelled":
      return {
        heading: "This booking was cancelled",
        body: "This booking is no longer active. No payment is currently due.",
        totalLabel: "Amount",
      };
    case "refunded":
      return {
        heading: "This booking was refunded",
        body: "This booking is no longer active. No payment is currently due.",
        totalLabel: "Amount",
      };
    case "paid":
    case "confirmed":
    default:
      return { heading: "Your booking", body: null, totalLabel: "Total paid" };
  }
}
