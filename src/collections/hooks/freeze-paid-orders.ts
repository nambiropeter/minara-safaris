const FROZEN_STATUSES = new Set(["paid", "confirmed", "refunded"]);

/**
 * Once money has changed hands the priced facts are a record, not a draft.
 * Status and staff notes stay editable; the figures do not.
 *
 * Payload's `beforeChange` hook receives the *full merged document* as
 * `data` on an update, not a sparse patch — currency and items are present
 * on every save, changed or not. So this can't treat "key present" as "key
 * changed"; it has to diff against the previous value. `previous` therefore
 * carries currency/items too, even though a caller only means to change
 * status.
 */
export function assertNotRepricingPaidOrder(args: {
  previous?: {
    status?: string;
    amountTotal?: number;
    currency?: string;
    items?: unknown;
  } | null;
  incoming: { amountTotal?: number; currency?: string; items?: unknown };
}): void {
  const previous = args.previous;
  if (!previous || !previous.status || !FROZEN_STATUSES.has(previous.status)) return;

  const touchesMoney =
    (args.incoming.amountTotal !== undefined &&
      args.incoming.amountTotal !== previous.amountTotal) ||
    (args.incoming.currency !== undefined && args.incoming.currency !== previous.currency) ||
    (args.incoming.items !== undefined &&
      JSON.stringify(args.incoming.items) !== JSON.stringify(previous.items));

  if (touchesMoney) {
    throw new Error("This order has already been paid; its figures cannot be changed.");
  }
}
