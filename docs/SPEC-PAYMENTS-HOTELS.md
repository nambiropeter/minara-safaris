# Spec — Payments, Hotel Search, Admin

Engineering spec for the work quoted in `docs/Minara Safaris - Platform Quotation-3.docx`.
Client-facing scope and pricing live there; this file is the build contract.

**Implementation plan for Part A:** `docs/superpowers/plans/2026-09-06-payments-and-orders.md`.
Parts B and C get their own plans when commissioned.

Three independent parts. **A** ships alone and is the only one that must exist.

| Part | Depends on | Quoted |
|---|---|---|
| A. Payments and orders | nothing | 80,000 |
| B. Hotel search at `/hotels` | A | 104,000 |
| C. Admin panel | A | 28,000 |
| (Customer accounts) | A | 32,000, deferred |

**Next 16 caveat.** Route handler signatures, caching directives and `params` semantics have all
moved recently. Read the relevant guide in `node_modules/next/dist/docs/` before writing route
code — do not assume the App Router API from memory. See `AGENTS.md`.

---

## A. Payments and orders

### A.1 Principle

**Stripe is the source of truth for payment. The signed webhook is the only thing that may mark an
order paid.** Not the browser, not the redirect, not the client. Everything below follows from that.

Paying requires no account. Customers reach their booking through an unguessable link emailed after
payment confirms.

### A.2 Data model

New Payload collection `Orders` (`src/collections/Orders.ts`):

| Field | Type | Notes |
|---|---|---|
| `orderNumber` | text | `MS-2026-0001`, generated in `beforeChange`, unique |
| `status` | select | `pending` `paid` `confirmed` `cancelled` `refunded` `failed` |
| `customer` | group | `name`, `email`, `phone` — email authoritative from Stripe |
| `items` | array | **price snapshot**, see below |
| `currency` | select | ISO 4217, uppercase |
| `amountTotal` | number | **minor units, integer.** Never a float, never a decimal column |
| `travelDate` | date | |
| `travellers` | group | `adults`, `children` |
| `stripe` | group | `checkoutSessionId`, `paymentIntentId`, `customerEmail` |
| `supplier` | group | Part B only — see B.5 |
| `accessTokenHash` | text | `sha256(token)`, indexed, unique, hidden in admin |
| `invoice` | upload | relation to Media, generated on payment |
| `staffNotes` | textarea | |

`items[]` is a **snapshot taken at order creation and never re-read from the source**:
`{ kind: 'package' | 'hotel', refId, title, unitAmount, quantity, subtotal }`.
A later CMS price edit must not change what a customer already agreed to pay.

Second collection `ProcessedEvents`: `{ eventId (unique, indexed), type, processedAt }`.
Idempotency ledger for webhooks. Nothing else.

### A.3 Invariants

These are the acceptance criteria, not aspirations.

1. **The client never sends an amount.** `POST /api/checkout` accepts identifiers and quantities
   only. The server reads the price from Payload and computes the total. A request carrying an
   `amount` field is rejected, not ignored.
2. **Only the webhook writes `paid`.** No other code path may set that status.
3. **Signature verified against the raw body.** `stripe.webhooks.constructEvent(rawBody, sig, secret)`.
   The handler must read the unparsed body (`await req.text()`); any framework body-parsing before
   this breaks verification silently.
4. **Idempotent.** Insert `event.id` into `ProcessedEvents` first; a duplicate key means already
   handled — return 200 and do nothing.
5. **Amount and currency cross-checked** in the webhook: `session.amount_total === order.amountTotal`
   and currencies match, or the order goes to `failed` and staff are alerted.
6. **Orders are immutable once paid.** `items`, `amountTotal` and `currency` become read-only via
   field-level access control. Only `status` and `staffNotes` stay writable.
7. **The redirect proves nothing.** `success_url` is UI convenience. The page renders whatever status
   the webhook has actually written, including "confirming payment" when it has not landed yet.

### A.4 Endpoints

```
POST /api/checkout              Zod-validated. Creates Order(pending), creates Stripe
                                Checkout Session with metadata.orderId, returns session URL.
POST /api/webhooks/stripe       runtime = 'nodejs'. Raw body. Signature + idempotency.
                                Handles checkout.session.completed,
                                checkout.session.async_payment_failed,
                                charge.refunded.
GET  /booking/[token]           Page (not API). force-dynamic, noindex.
GET  /api/booking/[token]/invoice   Presigned R2 URL, short expiry.
```

Zod applies at these two POST boundaries only — Payload already validates CMS-shaped data
(`CLAUDE.md`). Rate limiting reuses `allowRequest` from `src/lib/rate-limit.ts`, which already
exists as a shared helper. Its window and maximum are currently hardcoded at 5 per hour, which suits
the lead form and is too strict for checkout — parameterise it rather than writing a second limiter.

### A.5 The booking access link

- Token: `crypto.randomBytes(32).toString('base64url')`. Not a UUID, not derived from the order id.
- **Store `sha256(token)` only.** Plaintext exists in the email and nowhere else, so a database dump
  does not yield working links.
- No expiry. The customer needs this on their travel date, possibly a year out. Instead: a
  **rotate action** in the admin issues a new token and 404s the old link.
- `404` on an unknown token, never `403` — a 403 confirms the booking exists.
- Response headers: `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`.
  `robots` noindex on the page.
- **Read-only.** No cancel, no date change, no email change, no card data beyond last four. This,
  not the token, is what makes a leaked link survivable. Anything actionable added later needs a
  fresh emailed confirmation.

Set Stripe's `success_url` to this same link so the customer lands on their booking immediately.

### A.6 Invoice and email

Invoice PDF generated on payment confirmation, stored in R2 through the existing
`@payloadcms/storage-s3` setup, served only by presigned URL from the token-guarded route. Never a
guessable public key — a protected page beside an unprotected file is the classic hole.

Email via Resend, following `src/lib/notify-lead.ts`.

Generation and retries run on Payload's jobs queue, triggered by a Vercel cron. No worker service.

### A.7 SDK, not raw HTTP

Use the official `stripe` Node SDK, pinned exactly (`stripe@22.6.1`), server-side only.

The deciding factor is **webhook signature verification**. `constructEvent` parses the `t=`/`v1=`
header, reconstructs the signed payload, computes HMAC-SHA256, compares in constant time, and
enforces a replay window. Hand-rolling that has a nasty failure mode: a subtly wrong implementation
still passes every test you would naturally write, because genuine Stripe events verify fine — what
silently breaks is the rejection of forged ones, on the one code path allowed to mark an order paid.

Also: idempotency keys survive the SDK's automatic network retries, `event.data.object` narrows per
event type so webhook handling is not `any`-casting in money code, and the error taxonomy
(`StripeCardError` vs `StripeInvalidRequestError`) lets handlers branch without string-matching.

**Pin `apiVersion` explicitly** in `src/lib/stripe.ts`. Without it the account's dashboard default
applies, so someone clicking "upgrade" in the Stripe dashboard could change the shape of responses
this code parses with no code change and no deploy. Bump it together with the SDK, reading the value
from `Stripe.API_VERSION`.

The usual bundle-size objection does not apply — both call sites are route handlers with
`runtime = "nodejs"`, so the SDK never reaches the browser.

**Do not install `@stripe/stripe-js` or `@stripe/react-stripe-js`.** Hosted Checkout is a redirect
to `session.url`; there is no client-side Stripe code. Those packages become relevant only if
Payment Element is embedded on-site, which would widen PCI scope beyond SAQ-A.

Total API surface used: `checkout.sessions.create`, `webhooks.constructEvent`, and — in Part B —
`refunds.create`.

### A.8 Provider

Stripe, on the client's **UK** entity. Supported country, multi-currency presentment, and Checkout
handles SCA/3DS automatically for UK and EEA cards — which is also why we use hosted Checkout rather
than a card form, keeping us in PCI SAQ-A.

M-Pesa and Kenyan-resident rails are out of scope. If the merchant of record turns out to be Kenyan
rather than UK, the provider becomes Paystack or Pesapal; the order model, webhook shape and
idempotency ledger are provider-agnostic and unaffected. See Open Questions.

---

## B. Hotel search at `/hotels`

### B.1 Certification — the question asked

**A self-service test API key is enough to start building. Certification is only required before
production.**

- **Test:** register on the Hotelbeds developer portal, get an API key and secret immediately.
  Limited static dataset, no contract, no cost.
- **Production:** requires both a commercial agreement with HBX Group **and** passing their
  certification review, which checks that the integration calls CheckRate before booking, respects
  the look-to-book ratio, surfaces cancellation policies, and handles errors correctly.

So development is **not blocked** on the contract — start on sandbox now, and treat the commercial
track as a parallel workstream. Confirm current portal requirements directly with Hotelbeds; their
onboarding terms change.

### B.2 Auth

`Api-key: <key>` and `X-Signature: sha256(apiKey + secret + unixSeconds)`, regenerated per request.
`Accept: application/json`, gzip encouraged — availability responses are large.

### B.3 Flow

```
1  POST /hotel-api/1.0/hotels        availability: stay, occupancies, destination
2  cache result, key = hash(params), short TTL
3  user selects a rate
4  POST /hotel-api/1.0/checkrates    with rateKey, VERBATIM
5  price changed?  ->  show new price, require explicit re-confirm
6  create Order(pending)  ->  Stripe Checkout          [reuses A]
7  webhook paid  ->  POST /hotel-api/1.0/bookings
8  ok    -> store reference + cancellation policies
   fail  -> refund via Stripe, alert staff, order -> failed
```

**Never call `/bookings` without a preceding `/checkrates`.** Rates marked `RECHECK` are not
bookable directly and may have moved or vanished. `rateKey` is opaque — pass it byte for byte, never
parse, normalise or re-encode it.

### B.4 Look-to-book

Contractual, not advisory. Exceeding the ratio gets the account throttled or suspended.

- Searches run **only on explicit user submission with dates**. Never on page load, never on a
  destination or package page, never in a carousel.
- Identical searches served from cache for 15–30 minutes.
- Package and destination pages link to `/hotels?destination=…&checkIn=…&checkOut=…&adults=…`
  with dates prefilled but **editable** — a link, not an embedded live search. Those pages stay ISR
  and indexed.

### B.5 Supplier data on the order

`supplier` group on `Orders`:
`{ name: 'hotelbeds', reference, rateKey, netAmount, sellAmount, fxRate, cancellationPolicies[] }`

- `cancellationPolicies[]` is date-banded and differs per rate. Store it at booking time and display
  it. Some rates are non-refundable; Minara does not get to set its own policy.
- Margin: `sellAmount = netAmount * (1 + marginPct)`, `marginPct` in a Payload global so staff can
  change it without a deploy.
- `fxRate` snapshotted at order creation. Hotelbeds quotes in its contracted currency; the gap
  between that and the sell currency is margin risk.

### B.6 Content

**On demand, not a bulk catalogue ingest.** Fetch from the Content API the first time a hotel is
displayed, store what we render (name, images, description, geolocation, facilities) keyed by
`hotelCode` with a TTL, serve from cache after. Kenya and Tanzania only.

No mapping onto Minara `Destinations` — `/hotels` is a standalone section and renders Hotelbeds'
own content. That separation is what makes this 104,000 rather than 208,000.

### B.7 Routes

```
/hotels                    search form
/hotels/search             results (dynamic, noindex)
/hotels/[hotelCode]        detail, rooms and rates
POST /api/hotels/checkrate
```

Checkout reuses `POST /api/checkout` with `items[].kind = 'hotel'`.

### B.8 Explicitly not in scope

Safari camps and conservancy lodges. Bed banks do not carry them; packages keep their existing
accommodation, sourced by Minara as today. If Hotelbeds' property list turns out to cover them,
that is a scope change, not a bug.

---

## C. Admin panel

The `Orders` collection **is** the CRM. No Odoo, no second system.

| Change | Notes |
|---|---|
| Orders list view | `admin.defaultColumns`, `useAsTitle: 'orderNumber'`, status as a select |
| Saved views | `enableQueryPresets: true` — confirmed present in Payload 3.87.1 |
| Filtering, sorting, columns | **Free.** `WhereBuilder`, `ListControls`, `ColumnSelector` ship in `@payloadcms/ui`. Do not build these |
| CSV export | `@payloadcms/plugin-import-export`, version-matched to 3.87.1. **Not in core** |
| Dashboard | `admin.components.beforeDashboard` — bookings, revenue, upcoming departures |
| Ticket / voucher tracking | array field on Order: `{ type, reference, issuedAt, file }` |
| Rotate booking link | custom row action, regenerates `accessTokenHash` |
| Financial fields read-only once paid | field-level access control, per A.3.6 |

Staff auth already exists (`Users`). Customers, if ever added, become a **separate auth collection**
with `disableLocalStrategy: true` plus a custom `AuthStrategy` — all confirmed available in 3.87.1.
Never the same collection as staff.

---

## Test checklist

Each line is a test that must fail if the logic breaks.

**Payments**
- [ ] `POST /api/checkout` with a tampered `amount` — server uses its own figure
- [ ] Forged webhook POST — 400, no state change
- [ ] Replayed webhook (same `event.id`) — 200, no second fulfilment
- [ ] `session.amount_total` mismatch — order `failed`, staff alerted
- [ ] Order edited in admin after `paid` — financial fields rejected
- [ ] CMS price changed after order created — order total unchanged

**Booking link**
- [ ] Unknown token — 404, not 403
- [ ] Response is `no-store` and not served from cache
- [ ] Invoice URL is presigned and expires
- [ ] Rotate action invalidates the old link

**Hotels**
- [ ] `/bookings` refuses to run without a prior `/checkrates` for that rateKey
- [ ] CheckRate price change surfaces and requires re-confirm before charge
- [ ] Payment succeeds, `/bookings` fails — automatic refund fires, staff alerted
- [ ] Identical search inside the TTL does not hit Hotelbeds
- [ ] No Hotelbeds call fires on any package or destination page load

---

## Open questions

1. **Merchant of record and settlement.** UK entity paying out to a UK account? If funds must land
   in a Kenyan account for a Kenyan entity, the provider changes (A.8).
2. **UK VAT.** If the client is VAT-registered, UK travel sales may fall under the Tour Operators'
   Margin Scheme, which changes how invoices must be presented. Confirm with their accountant before
   the invoice template is built — this is a treatment question, not a layout one.
3. **Hotelbeds commercial track.** Contract status, and whether a deposit or credit line is required.
4. **Margin percentage** and rounding convention for hotel sell rates.
5. **Invoice numbering** — any sequence requirement from the client's accountant.
