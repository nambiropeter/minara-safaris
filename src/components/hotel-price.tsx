import { formatHotelMoney, nightsLabel } from "@/lib/hotel-format";
import { cn } from "@/lib/utils";

/**
 * The hotel counterpart to `PriceBlock`: a live supplier price is never rendered
 * bare either. The note says exactly what the figure covers (the stay, one room),
 * so "KES 17,250" can't be mistaken for a nightly rate.
 *
 * `lead="From"` is for a results list, where the figure is the cheapest room and
 * meal plan; leave it off once the visitor has picked a specific rate.
 */
export function HotelPrice({
  amount,
  currency,
  nights,
  lead,
  size = "card",
  className,
}: {
  amount: number;
  currency: "KES" | "USD";
  nights: number;
  lead?: "From";
  size?: "card" | "detail";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {lead && <span className="text-label text-muted-foreground">{lead}</span>}
        <span className={cn("font-heading tabular-nums", size === "detail" ? "text-title" : "text-heading")}>
          {formatHotelMoney(amount, currency)}
        </span>
      </p>
      <p className="text-label text-muted-foreground">
        for {nightsLabel(nights)}, one room{lead ? " · room and meals vary" : ""}
      </p>
    </div>
  );
}
