import { EnvelopeSimple } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { emailHref } from "@/lib/site";
import { cn } from "@/lib/utils";

type Props = {
  /** Prefills the subject and body. Pass the package title from a package page. */
  context?: string;
  label?: string;
  size?: "cta" | "default" | "lg";
  className?: string;
  /** Package slug, so the conversion event can be attributed. */
  slug?: string;
};

/**
 * Email as the second conversion channel, beside WhatsApp. Like the WhatsApp
 * CTA it leaves the site, so it carries `data-analytics-*` for the delegated
 * listener. Outline variant on purpose: green stays WhatsApp's.
 *
 * Renders nothing when no contact email is configured.
 */
export function EmailCta({
  context,
  label = "Email us",
  size = "cta",
  className,
  slug,
}: Props) {
  const href = context
    ? emailHref(`Enquiry: ${context}`, `Hi Minara Safaris, I'd like to ask about ${context}.`)
    : emailHref("Trip enquiry", "Hi Minara Safaris, I'd like help planning a trip.");
  if (!href) return null;

  return (
    <Button
      render={<a href={href} />}
      variant="outline"
      size={size}
      className={cn(className)}
      data-analytics-event="email_click"
      data-analytics-package={slug}
    >
      <EnvelopeSimple />
      {label}
    </Button>
  );
}
