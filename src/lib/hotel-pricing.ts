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

export function marginBpsFromEnv(): number {
  const raw = process.env.HOTEL_MARGIN_BPS;
  const bps = raw === undefined || raw === "" ? NaN : Number(raw);
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error("HOTEL_MARGIN_BPS must be a non-negative integer (basis points)");
  }
  return bps;
}
