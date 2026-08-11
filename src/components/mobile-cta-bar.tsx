import Link from "next/link";

import { WhatsAppCta } from "@/components/whatsapp-cta";
import { Button } from "@/components/ui/button";

/**
 * The persistent conversion affordance on phones, which is where most of this
 * traffic is. `pb-[env(safe-area-inset-bottom)]` keeps it clear of the iOS home
 * indicator; the matching spacer in the site layout keeps it from covering the
 * last row of content.
 */
export function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden">
      <div className="flex gap-2 px-4 py-3">
        <Button render={<Link href="/packages" />} variant="outline" size="cta" className="flex-1">
          Browse trips
        </Button>
        <WhatsAppCta className="flex-1" />
      </div>
    </div>
  );
}
