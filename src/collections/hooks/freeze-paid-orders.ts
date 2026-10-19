const FROZEN_STATUSES = new Set(["paid", "confirmed", "refunded"]);

type SupplierMoney = {
  netAmount?: number | null;
  marginBps?: number | null;
  fxEurPerKes?: number | null;
  fxUsdPerKes?: number | null;
  cancellationPolicies?: { from?: string | null; amount?: number | null }[] | null;
};

type Priced = {
  status?: string;
  amountTotal?: number;
  currency?: string;
  items?: unknown;
  supplier?: SupplierMoney | null;
};

const MONEY_KEYS = ["netAmount", "marginBps", "fxEurPerKes", "fxUsdPerKes"] as const;

const clean = (value: unknown) => (value === null || value === undefined ? undefined : value);
// A date is a moment, not a string: the admin form sends back "…T20:59:00.000Z" for what was
// stored as "…T23:59:00+03:00", and reading that as a price change blocked every status edit.
const moment = (iso: string | null | undefined) => (iso ? Date.parse(iso) || iso : undefined);
const policies = (list: SupplierMoney["cancellationPolicies"]) =>
  JSON.stringify((list ?? []).map((p) => ({ from: moment(p.from), amount: clean(p.amount) })));

/**
 * True if an update changes the facts a hotel's price was built from: the supplier's net,
 * our margin, the exchange rates, the cancellation fees. Booking outcome fields (status,
 * reference, notes) are deliberately not checked: the webhook writes those after payment.
 *
 * Compares only the keys the update actually carries. Payload may hand a hook the full
 * merged document or only the changed group, and either way an absent key is "not touched",
 * while a null or per-row id Payload adds on merge must not read as a change.
 */
function changedSupplierMoney(incoming: SupplierMoney | null | undefined, previous: SupplierMoney | null | undefined): { field: string; was: unknown; now: unknown } | null {
  if (!incoming) return null;
  for (const key of MONEY_KEYS) {
    if (incoming[key] !== undefined && clean(incoming[key]) !== clean(previous?.[key])) {
      return { field: `supplier.${key}`, was: previous?.[key], now: incoming[key] };
    }
  }
  if (incoming.cancellationPolicies !== undefined && policies(incoming.cancellationPolicies) !== policies(previous?.cancellationPolicies)) {
    return { field: "supplier.cancellationPolicies", was: policies(previous?.cancellationPolicies), now: policies(incoming.cancellationPolicies) };
  }
  return null;
}

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
export function assertNotRepricingPaidOrder(args: { previous?: Priced | null; incoming: Omit<Priced, "status"> }): void {
  const previous = args.previous;
  if (!previous || !previous.status || !FROZEN_STATUSES.has(previous.status)) return;

  const changed =
    args.incoming.amountTotal !== undefined && args.incoming.amountTotal !== previous.amountTotal
      ? { field: "amountTotal", was: previous.amountTotal, now: args.incoming.amountTotal }
      : args.incoming.currency !== undefined && args.incoming.currency !== previous.currency
        ? { field: "currency", was: previous.currency, now: args.incoming.currency }
        : args.incoming.items !== undefined && JSON.stringify(args.incoming.items) !== JSON.stringify(previous.items)
          ? { field: "items", was: JSON.stringify(previous.items), now: JSON.stringify(args.incoming.items) }
          : changedSupplierMoney(args.incoming.supplier, previous.supplier);

  if (changed) {
    // Name the field: "already paid" alone gave staff no way to tell a real repricing from a form round-trip artefact.
    console.error("paid order figure change refused", { field: changed.field, was: String(changed.was).slice(0, 400), now: String(changed.now).slice(0, 400) });
    throw new Error(`This order has already been paid; its figures cannot be changed. (${changed.field})`);
  }
}
