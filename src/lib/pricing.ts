import { toMinorUnits, type Currency } from "./money.ts";

export type PriceablePackage = {
  id: number | string;
  title: string;
  priceFrom: number;
  currency?: string | null;
};

export type OrderItemInput = {
  kind: "package";
  refId: string;
  quantity: number;
};

export type PricedItem = {
  kind: "package";
  refId: string;
  title: string;
  unitAmount: number;
  quantity: number;
  subtotal: number;
};

/**
 * The trust boundary for money. The request supplies identifiers and
 * quantities; every figure here comes from the catalogue. Nothing the browser
 * sends can influence the total.
 */
export function priceOrder(
  items: OrderItemInput[],
  lookup: (refId: string) => PriceablePackage | undefined,
): { items: PricedItem[]; currency: Currency; amountTotal: number } {
  if (items.length === 0) {
    throw new Error("An order needs at least one item.");
  }

  let currency: Currency | undefined;
  const priced: PricedItem[] = [];

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new RangeError(`Invalid quantity ${item.quantity} for ${item.refId}`);
    }

    const pkg = lookup(item.refId);
    if (!pkg) {
      throw new Error(`Unknown package: ${item.refId}`);
    }

    const itemCurrency = (pkg.currency ?? "KES") as Currency;
    if (currency && currency !== itemCurrency) {
      throw new Error("An order must use a single currency.");
    }
    currency = itemCurrency;

    const unitAmount = toMinorUnits(pkg.priceFrom, itemCurrency);
    priced.push({
      kind: "package",
      refId: item.refId,
      title: pkg.title,
      unitAmount,
      quantity: item.quantity,
      subtotal: unitAmount * item.quantity,
    });
  }

  return {
    items: priced,
    currency: currency as Currency,
    amountTotal: priced.reduce((sum, i) => sum + i.subtotal, 0),
  };
}
