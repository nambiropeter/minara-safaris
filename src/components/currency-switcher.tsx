"use client";

import {
  setCurrencyPreference,
  useCurrencyPreference,
  useUsdPerKes,
} from "@/components/currency-provider";
import { DISPLAY_CURRENCIES } from "@/lib/exchange-rates";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "default" | "sm";
};

/**
 * KES/USD toggle with clip-path transition (Emil Kowalski segmented control pattern).
 * Duplicates the active layer and animates a clip-path inset between tabs,
 * delivering seamless color and position transitions without overlapping artifacts.
 *
 * Renders nothing when no exchange rate could be fetched —
 * offering USD without a rate would show prices that can't be honoured.
 */
export function CurrencySwitcher({ className, size = "default" }: Props) {
  const usdPerKes = useUsdPerKes();
  const preferred = useCurrencyPreference() ?? "KES";
  if (!usdPerKes) return null;

  const isSm = size === "sm";

  return (
    <div
      role="group"
      aria-label="Display prices in"
      className={cn(
        "relative inline-flex items-center rounded-full border border-border/70 p-0.5 bg-background/50 select-none",
        isSm ? "h-8.5" : "h-11",
        className,
      )}
    >
      {/* Base layer: interactive buttons with accessible state */}
      <div className="flex w-full h-full items-center">
        {DISPLAY_CURRENCIES.map((currency) => (
          <button
            key={currency}
            type="button"
            aria-pressed={preferred === currency}
            onClick={() => setCurrencyPreference(currency)}
            data-analytics-event="currency_switch"
            data-analytics-currency={currency}
            className={cn(
              "flex-1 h-full rounded-full font-medium text-muted-foreground hover:text-foreground transition-transform duration-160 ease-out active:scale-[0.96] flex items-center justify-center cursor-pointer",
              isSm ? "px-2.5 text-xs min-w-8" : "px-3 text-label min-w-11",
            )}
          >
            {currency}
          </button>
        ))}
      </div>

      {/* Emil Kowalski clip-path duplicate active layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center p-0.5 transition-[clip-path] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{
          clipPath:
            preferred === "USD"
              ? "inset(0 0 0 50% round 9999px)"
              : "inset(0 50% 0 0 round 9999px)",
        }}
      >
        <div className="flex w-full h-full items-center bg-primary text-primary-foreground rounded-full shadow-xs">
          {DISPLAY_CURRENCIES.map((currency) => (
            <span
              key={currency}
              className={cn(
                "flex-1 h-full flex items-center justify-center font-semibold",
                isSm ? "px-2.5 text-xs min-w-8" : "px-3 text-label min-w-11",
              )}
            >
              {currency}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
