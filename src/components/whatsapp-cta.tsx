import { WhatsappLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { whatsappHref } from "@/lib/site";
import { cn } from "@/lib/utils";

type Props = {
  /** Prefills the message. Pass the package title from a package page. */
  context?: string;
  label?: string;
  size?: "cta" | "default" | "lg";
  className?: string;
  /** Package slug, so the conversion event can be attributed (PRD §4.8). */
  slug?: string;
};

/**
 * The site's primary conversion. It leaves the site, so the click has to be
 * measurable — `data-analytics-*` is the hook Phase 5 binds the event to, and
 * without it we cannot tell whether any of this works.
 *
 * Renders nothing when no WhatsApp number is configured. A dead wa.me link is
 * worse than an absent button: it looks like the business ignores you.
 */
export function WhatsAppCta({
  context,
  label = "Chat on WhatsApp",
  size = "cta",
  className,
  slug,
}: Props) {
  const message = context
    ? `Hi Minara Safaris, I'd like to ask about ${context}.`
    : "Hi Minara Safaris, I'd like help planning a trip.";
  const href = whatsappHref(message);
  if (!href) return null;

  return (
    <Button
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
      variant="whatsapp"
      size={size}
      className={cn(className)}
      data-analytics-event="whatsapp_click"
      data-analytics-package={slug}
    >
      <WhatsappLogo weight="fill" />
      {label}
    </Button>
  );
}
