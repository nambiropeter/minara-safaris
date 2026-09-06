/**
 * Money is integer minor units everywhere past this file. Floats are allowed
 * only at the boundary where a human typed a price into the admin panel.
 */
export type Currency = "KES" | "USD" | "GBP";

export const MINOR_UNIT_EXPONENT: Record<Currency, number> = {
  KES: 2,
  USD: 2,
  GBP: 2,
};

export function toMinorUnits(major: number, currency: Currency): number {
  if (!Number.isFinite(major)) {
    throw new RangeError(`Amount must be finite, got ${major}`);
  }
  if (major < 0) {
    throw new RangeError(`Amount must not be negative, got ${major}`);
  }
  const factor = 10 ** MINOR_UNIT_EXPONENT[currency];
  // Epsilon nudge so 10.005 * 100 = 1000.4999... rounds to 1001, not 1000.
  return Math.round(major * factor + Number.EPSILON * factor);
}

/**
 * Formats a monetary amount via `Intl.NumberFormat` currency style.
 * Uses the ISO code (e.g. "KES 47,320.00") rather than a symbol so amounts
 * stay unambiguous across the currencies we'll support.
 *
 * Always rounds **down** (floor) — never in the customer's disfavour.
 * e.g. KES 47,320.556 → "KES 47,320.55", not "KES 47,320.56".
 */
export function formatMoney(minor: number, currency: Currency): string {
  const factor = 10 ** MINOR_UNIT_EXPONENT[currency];
  const major = minor / factor;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    roundingMode: "floor",
  })
    .format(major)
    // Intl separates the code from the number with a non-breaking space
    // (U+00A0); normalise to a regular space.
    .replace(/ /g, " ");
}
