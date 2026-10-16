"use client";

import {
  setCurrencyPreference,
  useCurrencyPreference,
  useUsdPerKes,
} from "@/components/currency-provider";
import { DISPLAY_CURRENCIES } from "@/lib/exchange-rates";
import { cn } from "@/lib/utils";

/**
 * KES/USD toggle. Renders nothing when no exchange rate could be fetched —
 * offering USD without a rate would show prices that can't be honoured.
 */
export function CurrencySwitcher({ className }: { className?: string }) {
  const usdPerKes = useUsdPerKes();
  const preferred = useCurrencyPreference() ?? "KES";
  if (!usdPerKes) return null;

  return (
    <div
      role="group"
      aria-label="Display prices in"
      className={cn("inline-flex h-11 rounded-full border border-border/80 p-0.5", className)}
    >
      {DISPLAY_CURRENCIES.map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={preferred === currency}
          onClick={() => setCurrencyPreference(currency)}
          data-analytics-event="currency_switch"
          data-analytics-currency={currency}
          className={cn(
            "min-w-11 rounded-full px-2.5 text-label font-medium transition-colors",
            preferred === currency
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}
