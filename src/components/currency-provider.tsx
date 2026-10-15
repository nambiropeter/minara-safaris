"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

import { convertPrice, isDisplayCurrency, type DisplayCurrency } from "@/lib/exchange-rates";
import { formatPrice } from "@/lib/site";

/**
 * Visitor's chosen display currency. It lives in the browser (localStorage),
 * not a cookie, so catalogue pages stay statically rendered — the server
 * always renders the catalogue currency and the swap happens after hydration.
 * The rate itself is fetched on the server (24h cache) and handed down.
 */
const STORAGE_KEY = "minara-currency";
const CHANGE_EVENT = "minara-currency-change";

const RatesContext = createContext<number | null>(null);

function readPreference(): DisplayCurrency | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isDisplayCurrency(value) ? value : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setCurrencyPreference(currency: DisplayCurrency) {
  try {
    localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // Private mode: the choice just won't persist past this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function CurrencyProvider({
  usdPerKes,
  children,
}: {
  usdPerKes: number | null;
  children: React.ReactNode;
}) {
  return <RatesContext.Provider value={usdPerKes}>{children}</RatesContext.Provider>;
}

/** The rate, or null when the provider was unreachable (switcher hides, prices stay native). */
export function useUsdPerKes(): number | null {
  return useContext(RatesContext);
}

/** The visitor's preference, or null if they never chose one (show the catalogue currency). */
export function useCurrencyPreference(): DisplayCurrency | null {
  return useSyncExternalStore(subscribe, readPreference, () => null);
}

/**
 * Resolves what a catalogue price should display as. Without a rate, or
 * without a preference, the price stays in the currency it was entered in.
 */
export function useDisplayPrice(amount: number, native: DisplayCurrency) {
  const usdPerKes = useUsdPerKes();
  const preferred = useCurrencyPreference();
  const target = usdPerKes && preferred ? preferred : native;
  return {
    text: formatPrice(convertPrice(amount, native, target, usdPerKes ?? 1), target),
    converted: target !== native,
  };
}
