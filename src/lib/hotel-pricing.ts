import type { DisplayCurrency, KesRates } from "./exchange-rates";
import type { CancellationPolicy } from "./hotelbeds";

/**
 * Sell price from a supplier net price. Integer minor units throughout (all
 * Hotelbeds currencies we expect have 2 decimals) and rounded *up*, so margin is
 * never lost to rounding. Basis points: 1500 = 15%.
 *
 * ponytail: margin comes from HOTEL_MARGIN_BPS until the staff-editable
 * `hotel-settings` global lands; callers pass it in, so only the caller changes.
 */
export function applyMargin(netMajor: number, marginBps: number): number {
  if (!Number.isFinite(netMajor) || netMajor < 0) throw new Error("Invalid net price");
  if (!Number.isInteger(marginBps) || marginBps < 0) throw new Error("Invalid margin");
  const netMinor = Math.round(netMajor * 100);
  return Math.ceil((netMinor * (10_000 + marginBps)) / 10_000);
}

/**
 * Hotelbeds quotes in EUR on our account (verified against the test host; USD is
 * not offered), so the sell price converts to what the visitor pays in. Rounds
 * **up** in the target currency, unlike catalogue `convertPrice`: this is a sell
 * price with margin in it, and the figure shown is the figure charged either way.
 * KES goes up to a whole shilling, USD to the cent. Returns target minor units.
 */
export function eurToDisplay(eurMinor: number, to: DisplayCurrency, rates: KesRates): number {
  const { eurPerKes, usdPerKes } = rates;
  if (!eurPerKes) throw new Error("No EUR rate available");
  const eur = eurMinor / 100;
  if (to === "KES") return Math.ceil(eur / eurPerKes - 1e-9) * 100;
  return Math.ceil(eur * (usdPerKes / eurPerKes) * 100 - 1e-9);
}

export type SellContext = { marginBps: number; currency: DisplayCurrency; rates: KesRates };

/** Supplier net (EUR, major units) to the price the visitor sees and pays: margin, then FX. */
export const sellPrice = (netMajor: number, ctx: SellContext): number =>
  eurToDisplay(applyMargin(netMajor, ctx.marginBps), ctx.currency, ctx.rates);

/**
 * Cancellation terms as the customer sees them. Fees are Hotelbeds' to set; we only
 * carry them through the same margin and FX as the price, so a non-refundable rate
 * shows a fee equal to the price rather than to our cost. Free cancellation exists
 * only if the first fee starts in the future.
 */
export function describeCancellation(policies: CancellationPolicy[], ctx: SellContext, now = Date.now()) {
  const first = policies[0];
  return {
    freeCancellationUntil: first && Date.parse(first.from) > now ? first.from : null,
    policies: policies.map((p) => ({ from: p.from, amount: sellPrice(p.amount, ctx) })),
  };
}

export function marginBpsFromEnv(): number {
  const raw = process.env.HOTEL_MARGIN_BPS;
  const bps = raw === undefined || raw === "" ? NaN : Number(raw);
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error("HOTEL_MARGIN_BPS must be a non-negative integer (basis points)");
  }
  return bps;
}
