import { CurrencyProvider } from "@/components/currency-provider";
import { MobileCtaBar } from "@/components/mobile-cta-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getKesRates } from "@/lib/exchange-rates";

/**
 * The public site's shell. Payload's admin lives in the `(payload)` group and
 * deliberately does not inherit any of this.
 *
 * The exchange rate is read here once per (cached, 24h) render and handed to
 * the client so the currency switcher never fetches from the browser.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const rates = await getKesRates();

  return (
    <CurrencyProvider usdPerKes={rates?.usdPerKes ?? null}>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      {/* Clears the fixed mobile bar so it never covers the last row of content. */}
      <div aria-hidden className="h-[calc(4.75rem+env(safe-area-inset-bottom))] lg:hidden" />
      <MobileCtaBar />
    </CurrencyProvider>
  );
}
