import Link from "next/link";

import { Button } from "@/components/ui/button";
import { WhatsAppCta } from "@/components/whatsapp-cta";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-24 text-center sm:px-8">
      <p className="font-heading text-display text-muted-foreground">404</p>
      <h1 className="mt-4 text-heading">Page not found</h1>
      <p className="measure mt-2 text-muted-foreground">
        That page doesn&rsquo;t exist or may have moved. Browse packages and
        destinations, or message us directly.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/packages" />} variant="outline" size="cta">
          Browse packages
        </Button>
        <WhatsAppCta label="Ask us directly" />
      </div>
    </main>
  );
}
