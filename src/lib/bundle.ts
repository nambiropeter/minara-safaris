import type { Payload } from "payload";

import { convertPrice, isDisplayCurrency, type DisplayCurrency } from "./exchange-rates";
import { priceOrder, type PricedItem } from "./pricing";

/**
 * The package half of a package-plus-hotel order, priced from the catalogue exactly as
 * POST /api/checkout does (same `convertPrice`), so the figure shown with the hotel is the
 * figure charged. Null when the package can't take a hotel: unknown, unpublished, or lodging
 * already included. `priceNote` travels with it because a package price is never shown bare. The package is priced per person, for the whole hotel party.
 */
export async function priceBundlePackage(
  payload: Payload,
  packageId: string,
  currency: DisplayCurrency,
  quantity: number,
  rates: { usdPerKes: number },
): Promise<{ item: PricedItem; priceNote: string | null } | null> {
  const found = await payload.find({
    collection: "packages",
    where: { id: { equals: packageId }, isPublished: { equals: true } },
    limit: 1,
    depth: 0,
  });
  const pkg = found.docs[0];
  if (!pkg || pkg.accommodation !== "choose-your-own") return null;

  const native = isDisplayCurrency(pkg.currency) ? pkg.currency : "KES";
  const priced = priceOrder([{ kind: "package", refId: packageId, quantity }], () => ({
    id: pkg.id,
    title: pkg.title,
    priceFrom: convertPrice(pkg.priceFrom, native, currency, rates.usdPerKes),
    currency,
  }));
  return { item: priced.items[0], priceNote: pkg.priceNote ?? null };
}
