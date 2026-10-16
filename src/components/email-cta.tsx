import Link from "next/link";

import { EnvelopeSimple } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Preselects this package in the enquiry form (`?package=<id>`). */
  packageId?: number;
  label?: string;
  size?: "cta" | "default" | "lg";
  className?: string;
  /** Package slug, so the click can be attributed. */
  slug?: string;
};

/**
 * Email as the second channel beside WhatsApp. It opens the on-site enquiry
 * form rather than a mailto link: mailto silently does nothing on devices
 * with no mail handler, and the form already saves the lead and emails the
 * team (`notifyLead`). Outline variant on purpose: green stays WhatsApp's.
 */
export function EmailCta({
  packageId,
  label = "Email us",
  size = "cta",
  className,
  slug,
}: Props) {
  const href = packageId ? `/contact?package=${packageId}` : "/contact";

  return (
    <Button
      render={<Link href={href} />}
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
