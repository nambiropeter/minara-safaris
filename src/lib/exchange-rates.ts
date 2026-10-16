/**
 * KES/USD conversion for the currency switcher and checkout.
 *
 * Rates come from exchangerate-api.com and are fetched once, then held in
 * Next's data cache for 24 hours — never fetched per visit. With
 * EXCHANGERATE_API_KEY set the keyed v6 endpoint is used; without it, the
 * same provider's open endpoint (no key, updates daily) is the fallback.
 *
 * Catalogue prices are whole major units typed into the admin, so converted
 * figures are whole units too, rounded **down** — never in the customer's
 * disfavour, same rule as `formatMoney`. The browser and the checkout route
 * both call `convertPrice`, so the number shown is the number charged.
 */
export type DisplayCurrency = "KES" | "USD";

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["KES", "USD"];

export type KesRates = {
  /** How many US dollars one Kenyan shilling buys. */
  usdPerKes: number;
  /**
   * How many euros one Kenyan shilling buys. Hotelbeds quotes in EUR, so hotel
   * prices convert from it. Optional: the catalogue never needs it.
   */
  eurPerKes?: number;
  /** Provider's last-update timestamp, for the staff audit note. */
  updatedAt: string;
};

const ONE_DAY_SECONDS = 60 * 60 * 24;

export function parseRates(json: unknown): KesRates | null {
  if (!json || typeof json !== "object") return null;
  const body = json as {
    result?: string;
    conversion_rates?: Record<string, number>;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (body.result !== "success") return null;
  // The keyed endpoint calls it `conversion_rates`, the open one `rates`.
  const table = body.conversion_rates ?? body.rates;
  const usd = table?.USD;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) return null;
  const eur = table?.EUR;
  const eurPerKes = typeof eur === "number" && Number.isFinite(eur) && eur > 0 ? eur : undefined;
  return { usdPerKes: usd, eurPerKes, updatedAt: body.time_last_update_utc ?? "" };
}

/** Returns null when the provider is unreachable — callers fall back to the catalogue currency. */
export async function getKesRates(): Promise<KesRates | null> {
  const key = process.env.EXCHANGERATE_API_KEY;
  const url = key
    ? `https://v6.exchangerate-api.com/v6/${key}/latest/KES`
    : "https://open.er-api.com/v6/latest/KES";
  try {
    const res = await fetch(url, { next: { revalidate: ONE_DAY_SECONDS } });
    if (!res.ok) return null;
    return parseRates(await res.json());
  } catch {
    return null;
  }
}

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return value === "KES" || value === "USD";
}

/** Converts a whole-unit catalogue price. Same-currency amounts pass through untouched. */
export function convertPrice(
  amount: number,
  from: DisplayCurrency,
  to: DisplayCurrency,
  usdPerKes: number,
): number {
  if (from === to) return amount;
  const converted = from === "KES" ? amount * usdPerKes : amount / usdPerKes;
  // Epsilon guards 99.99999… from flooring to 99 when the true value is 100.
  return Math.floor(converted + 1e-9);
}
