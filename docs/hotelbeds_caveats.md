# Hotelbeds integration: caveats

Everything known to be unfinished, unverified or deliberately simplified. Tick a row off
**when it is fixed**, move it to "Closed" with the commit, and add new ones as they turn up.
Spec: `docs/SPEC-PAYMENTS-HOTELS.md` Part B. Branch: `feat/hotelbeds-integration`.

Status: **open** = not done, **verify** = built but not proven, **decision** = needs a call,
**dev-only** = harmless until it ships.

## Blockers before a production key

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 1 | **Search and rates are cached in memory (20 min), per instance.** On serverless that only dedupes within one instance, so it does not protect look-to-book across the account. **Deliberately left simple** at the client's current scale (decision 2026-10-16). A Postgres-backed version with call counters was built and then removed; it is in commit `12a527b` if it's wanted back | decision | A production key's look-to-book ratio needs it |
| 2 | **No request counters**, so the ratio can't be read off our side. Removed with #1 for the same reason | decision | Added back with the Postgres cache; about 20 lines |
| 2b | **The rate limiter and per-session limits are in-memory per instance** (`rate-limit.ts`), so on serverless they are looser than they read. Accepted at this volume | decision | Abuse shows up, then Postgres or Redis |
| 3 | **Production needs a commercial agreement and certification** (CheckRate before booking, cancellation display, error handling, look-to-book). Onboarding terms were never web-verified | open | Agreement signed, certification passed, live key and `HOTELBEDS_BASE_URL` set |
| 4 | **Taxes payable at the hotel are not shown.** Rates may carry them; not investigated. The *rate comments* (check-in hours, deposit on arrival, minimum age) and the supplier's legal name and VAT ("payable through") **are** now shown, before payment and on the booking page | verify | Checked against a real rate object, displayed if present |
| 5 | **Packaging rates are dropped, only `AT_WEB` rates are sold.** A conservative reading: Hotelbeds' own `filter.packaging` is accepted but ignored | verify | Confirmed with Hotelbeds at certification |

## Not built yet

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 6 | **Pay and book is built** (`POST /api/hotels/book`, then the webhook books after `paid`). Unit-tested end to end with mocks; **never run for real**: it needs the schema applied (#7, #29) and a Stripe test payment typed by a person | verify | One real test-mode booking: pay, see `confirmed`, a Hotelbeds reference, then cancel via the admin refund |
| 7 | **`supplier` group on `Orders`** (reference, rateKey, guests, net, margin, FX, cancellation fees, comments, outcome). Its price facts freeze once paid; the outcome stays writable. Migration generated, **not applied** | verify | Applied (#29), and a paid hotel order edited in the admin to confirm the freeze |
| 8 | **Auto-refund when Hotelbeds definitely refuses.** Refunds only a definite refusal. An *unknown* result (Hotelbeds answered a real cancellation with a 500 that had worked) refunds nothing, retries nothing and alerts staff to search Hotelbeds by order number. Unit-tested | verify | Seen live against a forced refusal |
| 9 | **Admin refund cancels the Hotelbeds booking first**, inside the free-cancellation window only. Where fees apply it refuses and staff settle it by hand in Stripe (no partial-refund arithmetic, deliberately) | decision | Partial refunds are wanted often enough to build |
| 10 | **Margin is a staff-editable global** (`hotel-settings`: margin percent plus an on/off switch), remembered for a minute per instance. `HOTEL_MARGIN_BPS` stays as a bootstrap fallback until a margin is saved; with neither, search refuses to price. Unit-tested, not seen in the admin | verify | Margin saved in the admin and seen to change a price; then drop the env var |
| 11 | **No health endpoints.** Built, then removed: Vercel doesn't need them and nothing probes them | decision | A host that needs liveness/readiness probes |
| 12 | **Combined package + hotel checkout** not built. Decision: standalone hotel booking first | decision | `/hotels?package=<id>` carries the package into one checkout; partial-failure and partial-refund rules decided |
| 13 | **FX is snapshotted per order** (EUR and USD per KES, margin, EUR net) in the `supplier` group and frozen once paid | verify | Seen on a real order |

## Built, not proven

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 14 | **Price-changed re-confirm** is unit-tested but never seen live (every sandbox rate re-checked at the same price) | verify | Seen in a browser with a rate that moves |
| 15 | **`RECHECK` rates** are handled defensively and tested with mocks only. Every sandbox rate is `BOOKABLE` | verify | Observed against a real `RECHECK` rate |
| 16 | **Only checked at desktop width**, and only in KES. Mobile layout and the USD switch are untested | verify | Checked on a phone-width viewport and with USD |
| 17 | **Price shifts can be exchange-rate drift.** `priceChanged` compares with what the visitor saw, so a daily FX refresh can flag a change the supplier didn't make | verify | Decide whether to tolerate small FX moves |
| 18 | **The session cookie stops scripted polling, not a determined bot** that loads the page first | open | Turnstile on the search submit if abuse appears |
| 30 | **The booking runs inside the Stripe webhook request**, about 1.6s on the sandbox. If Hotelbeds is slow Stripe may time out and redeliver; that is safe (the event is already claimed and the order already `paid`) but the booking outcome is still recorded by the first run | verify | Hotelbeds latency seen in production; `after()` if it matters |
| 31 | **A process that dies mid-booking** leaves the order `paid` with supplier status `booking`. Nothing reconciles it automatically; staff search Hotelbeds for the order number (`clientReference`) | open | A small reconcile job, if it ever happens |
| 32 | **Hotelbeds' `tolerance` is 2%**: a booking can come back up to 2% above the quoted net without failing. It is recorded (`bookedNetAmount`) and flagged in the order note, but it lowers the margin on that booking | decision | Set to 0 if a refund is preferred to a thinner margin |
| 33 | **Customer emails need Resend configured** (`RESEND_API_KEY`, sender, site URL); until then the confirmation and the "we refunded you" notice silently don't send. Staff alerts need `LEADS_NOTIFICATION_EMAIL` too. For an unknown or refused booking the staff alert is the only warning | open | Resend configured; one real send seen |

## Data and environment

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 19 | **Dev DB: the earlier migrations are not recorded in `payload_migrations`** although their columns exist (`packages.accommodation`, `destinations.hotel_destination`), and the two newest (`hotel_settings`, `hotel_supplier`) are not applied. A later `pnpm migrate` on that DB would fail on "already exists" | open | Rows inserted by hand, or the DB rebuilt from migrations |
| 29 | **Dev DB has two orphan tables, `hotel_cache` and `hotel_calls`** (both empty), created by a dev push from the since-removed Postgres cache. A push from this branch wants to drop them, and Payload asks for confirmation: a dev server waiting on that prompt will hang every page that needs Payload. The `supplier` columns and `hotel_settings` rows also aren't in the DB until that push completes | open | The push confirmed (drops two empty tables) or the tables dropped by hand |
| 21 | **Hotel areas are a database enum.** Adding a place means a code change in `hotel-destinations.ts` plus a one-line migration | decision | Accept it, or switch the field to plain text |
| 22 | **Destination codes verified on the sandbox only.** Zanzibar returned 0 hotels there | verify | Re-checked on the production host |
| 23 | **Sandbox prices can be extreme** (a 3-night B&B at KES 3.3 million against KES 44,000 for the cheapest in the same room type). Matches the sandbox's own €22,217 maximum | dev-only | Not an issue on live data; re-check |
| 24 | **`images.dangerouslyAllowLocalIP` is on in development.** NAT64 dev networks resolve `photos.hotelbeds.com` to `64:ff9b::` addresses that Next's SSRF guard blocks. Production keeps the guard | dev-only | Remove if the dev network changes |
| 25 | **Gallery uses Hotelbeds' photo order**, which can include odd shots (a knife block on one hotel) | open | Prefer exterior/room image types, or cap the count |

## Content and licensing

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 26 | **Seven Wikimedia placeholder photos are CC BY / CC BY-SA.** They need attribution wherever shown. Credits are in `public/images/README.md` | dev-only | Removed before launch with the rest of the stock imagery |
| 27 | **Hotelbeds photo and description usage terms are unverified** | verify | Read in the contract |
| 28 | **Land-only package prices are synthetic.** For "choose your own hotel" packages, `priceFrom` must exclude lodging and `priceNote` must say so; that is an admin responsibility, not enforced | open | Staff briefed, or a validation hook added |

## Decisions already made

- **Scale (2026-10-16):** the client is just starting out, so heavy machinery was cut: no Postgres cache, no call counters, no health endpoints. Kept: the session gate, the existing in-memory rate limiter, the margin global.
- Mara hotels are allowed in `/hotels` (the sandbox returns four camps; spec B.8 assumed none). Settled 2026-10-16.
- Hotels are a standalone section; packages with lodging included show no hotel search, packages set to "choose your own hotel" link into it.
- **After payment, only a definite Hotelbeds refusal is refunded automatically.** An ambiguous result is never refunded or retried: it stops for a human to check by order number (`clientReference`). Settled 2026-10-16, after the sandbox answered a real cancellation with a 500 that had worked.
- Hotelbeds quotes EUR only on this account; we convert to KES/USD, rounding **up** so margin survives the exchange.

## Closed

- **#20: `pnpm seed:hotels` run** (2026-10-16). Created 7 photos, 4 destinations, 6 packages and mapped the 4 existing destinations. Verified against the database afterwards: orders, leads, articles and users unchanged. The uploaded files are committed under `media/` (`a36330b`).
