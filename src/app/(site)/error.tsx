"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { WhatsAppCta } from "@/components/whatsapp-cta";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-24 text-center sm:px-8">
      <h1 className="text-heading">Something went wrong</h1>
      <p className="measure mt-2 text-muted-foreground">
        Try again, or message us directly and we&rsquo;ll help you from here.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="outline" size="cta" onClick={reset}>
          Try again
        </Button>
        <WhatsAppCta label="Ask us directly" />
      </div>
    </main>
  );
}
