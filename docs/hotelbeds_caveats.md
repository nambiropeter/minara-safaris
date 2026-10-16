# Hotelbeds integration: caveats

Everything known to be unfinished, unverified or deliberately simplified. Tick a row off
**when it is fixed**, move it to "Closed" with the commit, and add new ones as they turn up.
Spec: `docs/SPEC-PAYMENTS-HOTELS.md` Part B. Branch: `feat/hotelbeds-integration`.

Status: **open** = not done, **verify** = built but not proven, **decision** = needs a call,
**dev-only** = harmless until it ships.

## Blockers before a production key

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 1 | **Search and content caches are in-memory**, per process. They do not protect the look-to-book ratio across serverless instances, and the ratio is contractual. (`hotel-search.ts`, `hotel-content.ts`, `rate-limit.ts`) | open | Cache and search/booking counters live in Postgres (spec step 3) |
| 2 | **No call counters**, so the ratio can't be checked at all yet | open | Counters stored per search / checkrate / booking |
| 3 | **Production needs a commercial agreement and certification** (CheckRate before booking, cancellation display, error handling, look-to-book). Onboarding terms were never web-verified | open | Agreement signed, certification passed, live key and `HOTELBEDS_BASE_URL` set |
| 4 | **Taxes and fees payable at the hotel are not shown.** Rates may carry them; not investigated. Certification may check this | verify | Checked against a real rate object, displayed if present |
| 5 | **Packaging rates are dropped, only `AT_WEB` rates are sold.** A conservative reading: Hotelbeds' own `filter.packaging` is accepted but ignored | verify | Confirmed with Hotelbeds at certification |

## Not built yet

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 6 | **No pay-and-book step.** A confirmed rate currently hands off to WhatsApp ("Book with a consultant") | open | `items[].kind = 'hotel'` through `/api/checkout`, webhook books after `paid` (spec step 4) |
| 7 | **No `supplier` group on `Orders`** (reference, rateKey, net, sell, fxRate, cancellation policies) and no freeze on those figures | open | Added with a migration; `freeze-paid-orders.ts` extended |
| 8 | **No auto-refund if Hotelbeds fails after payment.** The refund helper exists (`refund-order.ts`) but is staff-only | open | Shared refund helper; webhook calls it; booking step has its own idempotency marker |
| 9 | **Admin refund ignores the Hotelbeds booking.** Refunding a paid hotel order would leave the supplier booking live | open | Refund cancels the Hotelbeds booking first, or blocks and shows the policy |
| 10 | **Margin comes from `HOTEL_MARGIN_BPS` (env)**, not the staff-editable `hotel-settings` global. Changing it needs a deploy | open | Global added, env removed |
| 11 | **No `/api/healthz` or `/api/readyz`** | open | Added (readyz must not call Hotelbeds) |
| 12 | **Combined package + hotel checkout** not built. Decision: standalone hotel booking first | decision | `/hotels?package=<id>` carries the package into one checkout; partial-failure and partial-refund rules decided |
| 13 | **EUR → KES/USD only**; the EUR net and the rate are not yet stored on an order, so the FX margin risk isn't recorded | open | `fxRate` snapshotted at order creation (with #7) |

## Built, not proven

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 14 | **Price-changed re-confirm** is unit-tested but never seen live (every sandbox rate re-checked at the same price) | verify | Seen in a browser with a rate that moves |
| 15 | **`RECHECK` rates** are handled defensively and tested with mocks only. Every sandbox rate is `BOOKABLE` | verify | Observed against a real `RECHECK` rate |
| 16 | **Only checked at desktop width**, and only in KES. Mobile layout and the USD switch are untested | verify | Checked on a phone-width viewport and with USD |
| 17 | **Price shifts can be exchange-rate drift.** `priceChanged` compares with what the visitor saw, so a daily FX refresh can flag a change the supplier didn't make | verify | Decide whether to tolerate small FX moves |
| 18 | **The session cookie stops scripted polling, not a determined bot** that loads the page first | open | Turnstile on the search submit if abuse appears |

## Data and environment

| # | Caveat | Status | Closes when |
|---|---|---|---|
| 19 | **Dev DB: the two new migrations are not recorded in `payload_migrations`** although their columns exist (`packages.accommodation`, `destinations.hotel_destination`). A later `pnpm migrate` on that DB would try to re-run them and fail on "already exists" | open | Rows inserted by hand, or the DB rebuilt from migrations |
| 20 | **`pnpm seed:hotels` has not been run.** Additive; adds six land-only packages, four destinations, seven photos | open | Run once, counts checked after |
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

- Mara hotels are allowed in `/hotels` (the sandbox returns four camps; spec B.8 assumed none). Settled 2026-10-16.
- Hotels are a standalone section; packages with lodging included show no hotel search, packages set to "choose your own hotel" link into it.
- Hotelbeds quotes EUR only on this account; we convert to KES/USD, rounding **up** so margin survives the exchange.

## Closed

_Nothing yet._
