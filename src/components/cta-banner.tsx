import Link from "next/link";

import { EmailCta } from "@/components/email-cta";
import { Button } from "@/components/ui/button";
import { WhatsAppCta } from "@/components/whatsapp-cta";

type Props = {
  title: string;
  description: string;
  whatsappContext?: string;
  whatsappLabel?: string;
  secondaryHref: string;
  secondaryLabel: string;
};

export function CtaBanner({
  title,
  description,
  whatsappContext,
  whatsappLabel,
  secondaryHref,
  secondaryLabel,
}: Props) {
  return (
    <section className="mt-16 border-t border-border bg-secondary/40 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 text-center sm:px-8">
        <h2 className="text-title">{title}</h2>
        <p className="measure mt-3 text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <WhatsAppCta context={whatsappContext} label={whatsappLabel} />
          <EmailCta context={whatsappContext} />
          <Button render={<Link href={secondaryHref} />} variant="outline" size="cta">
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
