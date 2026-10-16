import { cancellationLines, formatHotelDate, nightsLabel, type Cancellation } from "@/lib/hotel-format";
import type { Currency } from "@/lib/money";
import type { Order } from "@/payload-types";

/** What is true about the hotel, in words a customer can rely on. Never reveals more than we know. */
const STATUS_LINE: Record<NonNullable<NonNullable<Order["supplier"]>["status"]>, string> = {
  pending: "Waiting for your payment.",
  booking: "We are booking your hotel now. This page updates in a moment.",
  booked: "Your hotel is booked.",
  // Honest and calm: paid, being confirmed. The detail is for staff, not the customer.
  unknown: "We are confirming your hotel with the supplier and will email you shortly.",
  failed: "The hotel could not be booked, so your payment has been refunded.",
  cancelled: "This hotel booking was cancelled.",
};

/**
 * The hotel half of the private booking page. A pure server component: it only reads the
 * order. The cancellation terms are the ones stored when the customer agreed to pay, not
 * anything re-fetched, so the page can never quietly show terms they didn't accept.
 */
export function HotelBookingDetails({ order }: { order: Order }) {
  const supplier = order.supplier;
  if (!supplier || supplier.name !== "hotelbeds") return null;

  const currency = order.currency as Currency;
  const policies = (supplier.cancellationPolicies ?? []).map((p) => ({ from: p.from, amount: p.amount }));
  const first = policies[0];
  const cancellation: Cancellation = {
    freeCancellationUntil: first && Date.parse(first.from) > Date.now() ? first.from : null,
    policies,
  };

  const nights =
    supplier.checkIn && supplier.checkOut
      ? Math.round((Date.parse(supplier.checkOut) - Date.parse(supplier.checkIn)) / 86_400_000)
      : null;
  const guests = `${order.adults ?? 1} ${(order.adults ?? 1) === 1 ? "adult" : "adults"}${
    order.children ? `, ${order.children} ${order.children === 1 ? "child" : "children"}` : ""
  }`;

  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="hotel-heading">
      <h2 id="hotel-heading" className="text-heading">
        Your hotel
      </h2>
      {supplier.status && <p className="mt-2 text-muted-foreground">{STATUS_LINE[supplier.status]}</p>}

      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-[auto_1fr]">
        {supplier.hotelName && <Row label="Hotel" value={supplier.hotelName} />}
        {supplier.roomName && <Row label="Room" value={supplier.roomName} />}
        {supplier.boardName && <Row label="Meals" value={supplier.boardName.charAt(0) + supplier.boardName.slice(1).toLowerCase()} />}
        {supplier.checkIn && supplier.checkOut && (
          <Row
            label="Stay"
            value={`${formatHotelDate(supplier.checkIn)} to ${formatHotelDate(supplier.checkOut)}${nights ? ` (${nightsLabel(nights)})` : ""}`}
          />
        )}
        <Row label="Guests" value={guests} />
        {supplier.status === "booked" && supplier.reference && <Row label="Hotel confirmation number" value={supplier.reference} />}
      </dl>

      {policies.length > 0 && supplier.status !== "failed" && supplier.status !== "cancelled" && (
        <div className="mt-6">
          <h3 className="text-label font-medium">Cancellation</h3>
          <ul className="mt-1 text-sm text-muted-foreground">
            {cancellationLines(cancellation, currency, order.amountTotal).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {supplier.rateComments && (
        <div className="mt-6">
          <h3 className="text-label font-medium">Good to know</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{supplier.rateComments}</p>
        </div>
      )}

      {supplier.status === "booked" && supplier.payableTo && (
        <p className="mt-6 text-label text-muted-foreground">Payable through {supplier.payableTo}.</p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
