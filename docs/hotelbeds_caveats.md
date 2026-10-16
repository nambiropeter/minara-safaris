# Hotelbeds integration: caveats

Everything known to be unfinished, unverified or deliberately simplified. Tick a row off
**when it is fixed**, move it to "Closed" with the commit, and add new ones as they turn up.
Spec: `docs/SPEC-PAYMENTS-HOTELS.md` Part B. Branch: `feat/hotelbeds-integration`.

**Two different things live here, and they are kept apart on purpose:**
the integration *running* (sections 1 and 2) versus *going to production* (section 3).
Section 3 never stops development or testing; it is the Hotelbeds half of `docs/PRE-PROD.md`.

Status: **open** = not done, **verify** = built but not proven, **decision** = a call was made or is needed,
**pre-prod** = only matters before real customers, **dev-only** = harmless until it ships.

## 1. What stops the integration running right now

**Nothing structural, as of 2026-10-16.** The dev database has the full schema, the Hotelbeds test key,
Stripe test keys and the margin fallback are set, and the first real end-to-end booking has run
(see "Closed"). One practical limit:

- **The sandbox key returned `403 Quota exceeded`** (2026-10-16) after a burst of about ten calls in a few
  seconds. Not yet known whether that is a per-second throttle or a daily cap. It stops *live testing*
  temporarily, not the integration. Pace test calls, and find out which it is before the next long test.
  In production a throttled booking after payment is classed as a refusal and refunded (safe, but
  unfriendly); a short retry on 403/429 would be kinder.

To run an end-to-end test: dev server on :3000, `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
(its `whsec_` must match `STRIPE_WEBHOOK_SECRET`), then pay with a Stripe test card (typed by a person).

## 2. Built, not yet proven (all testable now, in the sandbox)

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 6 | **Pay and book is built** (`POST /api/hotels/book`, then the webhook books after `paid`). Unit-tested end to end with mocks; **never run for real**: it needs the schema applied (#7, #29) and a Stripe test payment typed by a person | verify | One real test-mode booking: pay, see `confirmed`, a Hotelbeds reference, then cancel via the admin refund |
| 7 | **`supplier` group on `Orders`** (reference, rateKey, guests, net, margin, FX, cancellation fees, comments, outcome). Price facts freeze once paid; the outcome stays writable. Schema applied to the dev DB 2026-10-16 | verify | A paid hotel order edited in the admin to confirm the freeze |
| 8 | **Auto-refund when Hotelbeds definitely refuses.** Refunds only a definite refusal. An *unknown* result (Hotelbeds answered a real cancellation with a 500 that had worked) refunds nothing, retries nothing and alerts staff to search Hotelbeds by order number. Unit-tested | verify | Seen live against a forced refusal |
| 10 | **Margin is a staff-editable global** (`hotel-settings`: margin percent plus an on/off switch), remembered for a minute per instance. `HOTEL_MARGIN_BPS` stays as a bootstrap fallback until a margin is saved; with neither, search refuses to price. Unit-tested, not seen in the admin | verify | Margin saved in the admin and seen to change a price; then drop the env var |
| 13 | **FX is snapshotted per order** (EUR and USD per KES, margin, EUR net) in the `supplier` group and frozen once paid | verify | Seen on a real order |
| 14 | **Price-changed re-confirm** is unit-tested but never seen live (every sandbox rate re-checked at the same price) | verify | Seen in a browser with a rate that moves |
| 15 | **`RECHECK` rates** are handled defensively and tested with mocks only. Every sandbox rate is `BOOKABLE` | verify | Observed against a real `RECHECK` rate |
| 16 | **Only checked at desktop width**, and only in KES. Mobile layout and the USD switch are untested | verify | Checked on a phone-width viewport and with USD |
| 30 | **The booking runs inside the Stripe webhook request**, about 1.6s on the sandbox. If Hotelbeds is slow Stripe may time out and redeliver; that is safe (the event is already claimed and the order already `paid`) but the booking outcome is still recorded by the first run | verify | Hotelbeds latency seen across several bookings; `after()` if it matters |

## 3. PRE-PRODUCTION only

None of this affects development or testing. It must be done before real customers.
The checklist form is in `docs/PRE-PROD.md` under **Hotelbeds**.

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 3 | **No production access yet.** Production needs a commercial agreement with HBX Group, passing certification (CheckRate before booking, cancellation display, error handling, look-to-book), a live key, and `HOTELBEDS_BASE_URL` pointed at the production host (it defaults to the **test** host). Onboarding terms were never web-verified. This is the one hard gate to taking real hotel bookings | pre-prod | Agreement signed, certification passed, live key and `HOTELBEDS_BASE_URL` set |
| 1 | **Search and rates are cached in memory (20 min), per instance.** On serverless that only dedupes within one instance, so it does not protect the account's look-to-book ratio. Deliberately simple at the client's current scale (decision 2026-10-16). A Postgres version with call counters existed in commit `12a527b` | pre-prod | A production key's look-to-book needs it: add the Postgres cache and counters back |
| 2 | **No request counters**, so the ratio can't be read off our side. Removed with #1 for the same reason | pre-prod | Added back with the Postgres cache; about 20 lines |
| 2b | **The rate limiter and per-session limits are in-memory per instance** (`rate-limit.ts`), so on serverless they are looser than they read. Accepted at this volume | pre-prod | Abuse shows up, then Postgres or Redis |
| 4 | **Taxes payable at the hotel are not shown.** Rates may carry them; not investigated. The *rate comments* (check-in hours, deposit on arrival, minimum age) and the supplier's legal name and VAT ("payable through") **are** now shown, before payment and on the booking page | pre-prod | Checked against a real rate object, displayed if present (certification may check) |
| 5 | **Packaging rates are dropped, only `AT_WEB` rates are sold.** A conservative reading: Hotelbeds' own `filter.packaging` is accepted but ignored | pre-prod | Confirmed with Hotelbeds at certification |
| 18 | **The session cookie stops scripted polling, not a determined bot** that loads the page first | pre-prod | Abuse shows up, then Turnstile on the search submit |
| 19 | **Migrations must be applied to the production DB in order.** The dev DB was kept in sync by dev-mode push, so its `payload_migrations` table doesn't list the recent ones. Production must use `pnpm migrate` from the start. Five hotel migrations are involved (`packages_accommodation`, `destinations_hotel_destination`, `hotel_settings`, `hotel_supplier`, plus the earlier ones) | pre-prod | `pnpm migrate` run on production, `pnpm migrate:status` clean |
| 22 | **Destination codes verified on the sandbox only.** Zanzibar returned 0 hotels there | pre-prod | Re-checked on the production host |
| 26 | **Seven Wikimedia placeholder photos are CC BY / CC BY-SA.** They need attribution wherever shown. Credits are in `public/images/README.md` | pre-prod | Removed before launch with the rest of the stock imagery |
| 27 | **Hotelbeds photo and description usage terms are unverified** | pre-prod | Read in the contract |
| 28 | **Land-only package prices are synthetic.** For "choose your own hotel" packages, `priceFrom` must exclude lodging and `priceNote` must say so; that is an admin responsibility, not enforced | pre-prod | Staff briefed, or a validation hook added |
| 31 | **A process that dies mid-booking** leaves the order `paid` with supplier status `booking`. Nothing reconciles it automatically; staff search Hotelbeds for the order number (`clientReference`) | pre-prod | A small reconcile job, if it ever happens |
| 32 | **Hotelbeds' `tolerance` is 2%**: a booking can come back up to 2% above the quoted net without failing. It is recorded (`bookedNetAmount`) and flagged in the order note, but it lowers the margin on that booking | pre-prod | Set to 0 if a refund is preferred to a thinner margin |
| 33 | **Customer emails and staff alerts need Resend configured** (`RESEND_API_KEY`, sender, site URL, `LEADS_NOTIFICATION_EMAIL`). Until then a refused or unknown hotel booking alerts nobody, and a refunded customer hears nothing from us. Not needed to develop or test; needed before anyone real pays | pre-prod | Resend configured; one real send seen |

## 4. Known limits and decisions (development)

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 9 | **Admin refund cancels the Hotelbeds booking first**, inside the free-cancellation window only. Where fees apply it refuses and staff settle it by hand in Stripe (no partial-refund arithmetic, deliberately) | decision | Partial refunds are wanted often enough to build |
| 11 | **No health endpoints.** Built, then removed: Vercel doesn't need them and nothing probes them | decision | A host that needs liveness/readiness probes |
| 12 | **Combined package + hotel checkout is not built.** Decision: prove standalone hotel booking live first. It adds a second money path with its own partial-failure rules (see "Why not yet" below) | decision | Standalone proven live; then the rules below decided |
| 17 | **Price shifts can be exchange-rate drift.** `priceChanged` compares with what the visitor saw, so a daily FX refresh can flag a change the supplier didn't make | verify | Decide whether to tolerate small FX moves |
| 21 | **Hotel areas are a database enum.** Adding a place means a code change in `hotel-destinations.ts` plus a one-line migration | decision | Accept it, or switch the field to plain text |
| 23 | **Sandbox prices can be extreme** (a 3-night B&B at KES 3.3 million against KES 44,000 for the cheapest in the same room type). Matches the sandbox's own €22,217 maximum | dev-only | Not an issue on live data; re-check |
| 24 | **`images.dangerouslyAllowLocalIP` is on in development.** NAT64 dev networks resolve `photos.hotelbeds.com` to `64:ff9b::` addresses that Next's SSRF guard blocks. Production keeps the guard | dev-only | Remove if the dev network changes |
| 25 | **Gallery uses Hotelbeds' photo order**, which can include odd shots (a knife block on one hotel) | open | Prefer exterior/room image types, or cap the count |

### #12: the design, as decided (2026-10-16)

Not started until the standalone booking was proven live (it now is). The decisions, from Leo:

- **One checkout and one payment for a package and a hotel**, but kept separate *on paper*: the order carries
  two items, and each can still be bought alone (hotel only, package only, or ask an agent).
- **If the hotel is refused, the package stays.** Only the hotel's part is refunded (a **partial** Stripe
  refund), the package remains paid for staff to confirm.
- Standalone paths stay, because some rates are non-refundable and some customers will want a hotel alone
  or to deal with an agent.

What that means to build: a partial-refund path (today's refund helper and admin button are full-only); the
webhook must set `confirmed` automatically **only for hotel-only orders** (in a bundle the package still needs
staff confirmation, so the order stays `paid` and `supplier.status` carries the hotel); the admin refund needs
to know which item it is refunding; `/hotels?package=<id>` as the entry from a package page.

## Decisions already made

- **Scale (2026-10-16):** the client is just starting out, so heavy machinery was cut: no Postgres cache, no call counters, no health endpoints. Kept: the session gate, the existing in-memory rate limiter, the margin global.
- **After payment, only a definite Hotelbeds refusal is refunded automatically.** An ambiguous result is never refunded or retried: it stops for a human to check by order number (`clientReference`). Settled 2026-10-16, after the sandbox answered a real cancellation with a 500 that had worked.
- Mara hotels are allowed in `/hotels` (the sandbox returns four camps; spec B.8 assumed none). Settled 2026-10-16.
- Hotels are a standalone section; packages with lodging included show no hotel search, packages set to "choose your own hotel" link into it.
- Hotelbeds quotes EUR only on this account; we convert to KES/USD, rounding **up** so margin survives the exchange.

## Closed

- **First real end-to-end booking** (2026-10-16, dev server, Stripe sandbox, Hotelbeds test host). The Boma Nairobi, Superior room, room only, 10 to 13 Feb 2027, KES 48,862. Webhook answered 200 on every event; the order went `pending` to `confirmed` by itself with Hotelbeds reference `286-2159018`, our order number as `clientReference`, booked net equal to quoted net (EUR 292.14), the fee schedule stored, and the supplier "payable through" entity recorded (`HOTELBEDS DMCC`, it differs per booking). **Not yet covered:** the admin refund cancelling the booking first, a forced refusal, an unknown outcome, the booking page's hotel block, emails.
- **"From" price on the results list was wrong for 30% of hotels** (found 2026-10-16 by measuring the sandbox): it used Hotelbeds' hotel-level minimum, which includes packaging rates we don't sell, so 12 of 40 hotels advertised a price 6-17% below anything we could offer. Now computed from sellable rates only, and a hotel with nothing sellable isn't listed. Unit-tested; **live re-check pending the sandbox quota** (#1 above).

- **#20: `pnpm seed:hotels` run** (2026-10-16). Created 7 photos, 4 destinations, 6 packages and mapped the 4 existing destinations. Verified against the database afterwards: orders, leads, articles and users unchanged. The uploaded files are committed under `media/` (`a36330b`).
- **#29: dev DB schema complete** (2026-10-16). After a partial dev push (two empty orphan tables left by the removed Postgres cache, and a rename prompt), the dev server was restarted and answered "create". Verified read-only: all 20 `supplier_*` columns, the fee-schedule table and `hotel_settings` exist, the orphans are gone, and orders (11) and packages (12) are unchanged.
