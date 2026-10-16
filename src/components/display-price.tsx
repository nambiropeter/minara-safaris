"use client";

import { useDisplayPrice } from "@/components/currency-provider";
import type { DisplayCurrency } from "@/lib/exchange-rates";

/** A catalogue figure in the visitor's chosen currency. Only `PriceBlock` renders this. */
export function DisplayPrice({ amount, currency }: { amount: number; currency: DisplayCurrency }) {
  return <>{useDisplayPrice(amount, currency).text}</>;
}

/**
 * Says so when a figure has been converted. A converted price is the day's
 * rate applied to a KES (or USD) catalogue price, and the visitor should know
 * it can move.
 */
export function ConversionNote({ currency }: { currency: DisplayCurrency }) {
  const { converted } = useDisplayPrice(0, currency);
  if (!converted) return null;
  return (
    <p className="text-label text-muted-foreground">
      Converted from {currency} at today&apos;s exchange rate
    </p>
  );
}
