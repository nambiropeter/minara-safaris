/**
 * Stripe tells us what was paid; the order says what was owed. If they differ,
 * something is wrong — a tampered session, a currency mix-up, a code bug — and
 * the safe move is to refuse rather than fulfil.
 */
export function assertAmountMatches(
  session: { amount_total: number | null; currency: string | null },
  order: { amountTotal: number; currency: string },
): void {
  if (session.amount_total !== order.amountTotal) {
    throw new Error(
      `Amount mismatch: paid ${session.amount_total}, owed ${order.amountTotal}`,
    );
  }
  if ((session.currency ?? "").toUpperCase() !== order.currency.toUpperCase()) {
    throw new Error(
      `Currency mismatch: paid ${session.currency}, owed ${order.currency}`,
    );
  }
}
