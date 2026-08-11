import { MobileCtaBar } from "@/components/mobile-cta-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * The public site's shell. Payload's admin lives in the `(payload)` group and
 * deliberately does not inherit any of this.
 */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      {/* Clears the fixed mobile bar so it never covers the last row of content. */}
      <div aria-hidden className="h-[calc(4.75rem+env(safe-area-inset-bottom))] lg:hidden" />
      <MobileCtaBar />
    </>
  );
}
