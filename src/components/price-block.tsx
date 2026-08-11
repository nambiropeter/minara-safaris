import type { Package } from "@/payload-types";
import { formatPrice } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The only place a price is rendered.
 *
 * `priceNote` is not optional decoration — a bare "KES 45,000" generates
 * bad-fit enquiries and burns agent time (PRD §4.3), so the note and the
 * resident rate travel with the number by construction rather than by
 * discipline. Both fields are `required` in the CMS; this component is what
 * makes that guarantee visible.
 */
export function PriceBlock({
  pkg,
  size = "card",
  className,
}: {
  pkg: Package;
  size?: "card" | "detail";
  className?: string;
}) {
  const currency = pkg.currency ?? "KES";
  const isDetail = size === "detail";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-label text-muted-foreground">From</span>
        <span
          className={cn(
            "font-heading tabular-nums",
            isDetail ? "text-title" : "text-heading",
          )}
        >
          {formatPrice(pkg.priceFrom, currency)}
        </span>
      </p>
      <p className="text-label text-muted-foreground">{pkg.priceNote}</p>
      {typeof pkg.priceResident === "number" && (
        <p className="text-label">
          <span className="font-medium tabular-nums">
            {formatPrice(pkg.priceResident, currency)}
          </span>{" "}
          <span className="text-muted-foreground">
            for Kenyan and East African residents
          </span>
        </p>
      )}
    </div>
  );
}
