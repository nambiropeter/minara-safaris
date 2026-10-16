import { formatMoney, type Currency } from "./money";

/** Hotel prices arrive as minor units in the visitor's currency; whole shillings read cleaner without ".00". */
export const formatHotelMoney = (minor: number, currency: Currency) =>
  formatMoney(minor, currency).replace(/\.00$/, "");

export const nightsLabel = (nights: number) => `${nights} ${nights === 1 ? "night" : "nights"}`;

// Kenya and Tanzania share a timezone, and cancellation cut-offs are stated in hotel-local time.
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });
export const formatHotelDate = (iso: string) => day.format(new Date(iso));

export type Cancellation = { freeCancellationUntil: string | null; policies: { from: string; amount: number }[] };

/**
 * The cancellation terms as lines a customer can read. The terms are Hotelbeds'
 * to set, never ours to soften: no free window means say so plainly. `price` lets
 * a fee smaller than the whole stay read as "fees apply" and not "non-refundable".
 */
export function cancellationLines(c: Cancellation, currency: Currency, price: number): string[] {
  if (!c.freeCancellationUntil) {
    const first = c.policies[0];
    if (!first || first.amount >= price) return ["Non-refundable"];
    return ["No free cancellation", ...c.policies.map((p) => `From ${formatHotelDate(p.from)}: ${formatHotelMoney(p.amount, currency)} fee`)];
  }
  return [
    `Free cancellation until ${formatHotelDate(c.freeCancellationUntil)}`,
    ...c.policies.map((p) => `From ${formatHotelDate(p.from)}: ${formatHotelMoney(p.amount, currency)} fee`),
  ];
}

/**
 * The terms stored on an order when the customer agreed to pay, as they stand now: free
 * cancellation exists only while the first fee is still in the future. The clock is a
 * parameter so this stays testable and a component never has to read it while rendering.
 */
export function storedCancellation(
  policies: { from: string; amount: number }[],
  now = Date.now(),
): Cancellation {
  const first = policies[0];
  return { freeCancellationUntil: first && Date.parse(first.from) > now ? first.from : null, policies };
}
