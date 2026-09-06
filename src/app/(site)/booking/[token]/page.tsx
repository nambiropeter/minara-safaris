import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatMoney, type Currency } from "@/lib/money";
import { findOrderByToken } from "@/lib/orders";

/** Per-customer and never cached. ISR here would serve one person's booking to another. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await findOrderByToken(token);

  // 404 rather than 403 — a 403 would confirm the booking exists.
  if (!order) notFound();

  const currency = order.currency as Currency;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-label text-muted-foreground">Booking {order.orderNumber}</p>
      <h1 className="text-title mt-1">
        {order.status === "pending" ? "Confirming your payment" : "Your booking"}
      </h1>

      {order.status === "pending" && (
        <p className="text-lead mt-3">
          We are waiting for your payment to confirm. This page updates once it does — refresh in a
          moment.
        </p>
      )}

      <dl className="mt-8 space-y-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between gap-4">
            <dt>
              {item.title}
              {item.quantity > 1 ? ` x${item.quantity}` : ""}
            </dt>
            <dd>{formatMoney(item.subtotal, currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
          <dt>Total paid</dt>
          <dd>{formatMoney(order.amountTotal, currency)}</dd>
        </div>
      </dl>

      <p className="text-label text-muted-foreground mt-8">
        Keep this link. It is the only way back to this page, and it does not expire.
      </p>
    </main>
  );
}
