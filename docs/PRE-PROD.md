# Pre-production checklist

Everything that must be true before real customers touch the site. Tick an item only when
*verified*, and note where (host, date) so a fresh session doesn't redo it. Build status lives in
`docs/WORK-PLAN.md`; this file is only the launch gate.

## Stripe

- [ ] **Webhook endpoint exists on the live account**, pointing at `https://<domain>/api/webhooks/stripe`,
      subscribed to exactly these five events:
      `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
      Test mode has its own separate endpoint; the sandbox currently has none. Locally, use
      `stripe listen --forward-to localhost:3000/api/webhooks/stripe` instead.
- [ ] `STRIPE_WEBHOOK_SECRET` in the host's env is the **endpoint's** signing secret (`whsec_…`),
      not the one `stripe listen` prints, and not the test-mode one.
- [ ] `STRIPE_SECRET_KEY` is the live key (`sk_live_…`) on the host. `.env.local` keeps the test key.
- [x] One real test-mode refund done end to end (2026-10-15, local, sandbox): the webhook marks the order `refunded`, staff note
      added, `freeze-paid-orders` hook doesn't block it.
- [ ] One small live payment made and refunded after switching to live keys.
- [ ] Accountant has answered the UK VAT / Tour Operators' Margin Scheme question. Until then
      customers get Stripe receipts, not our own invoices (`docs/SPEC-PAYMENTS-HOTELS.md`).

## Email (Resend)

- [ ] `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `LEADS_NOTIFICATION_EMAIL` set on the host. Email has
      never actually been sent; it no-ops without these.
- [ ] Sending domain verified in Resend (SPF/DKIM).
- [ ] A real enquiry produces the staff alert, and a real paid booking produces the customer
      confirmation with a working `/booking/<token>` link. Both need `NEXT_PUBLIC_SITE_URL`.

## Database

- [ ] Production Neon branch exists; `DATABASE_URI` on the host points at it, not `dev`.
- [ ] `pnpm migrate` run against it, then `pnpm migrate:status` shows every row `Yes`. Payload's
      dev-mode auto-push is a dev-only loop; the committed migrations are the prod artifact.
- [ ] Seed content removed (`pnpm seed` creates synthetic packages, destinations, articles).
- [ ] `PAYLOAD_SECRET` is a fresh value, not the dev one. First staff user created in the prod admin.

## Site, SEO and analytics

- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain. Until it is, the site is `noindex`, and
      canonical/OG/sitemap and Plausible stay off.
- [ ] Plausible shows a WhatsApp click and an enquiry submit arriving from the live domain
      (WhatsApp tracking is a launch blocker).
- [ ] R2 env vars set (`R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`);
      an admin image upload lands in the bucket and renders through `next/image`.
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` is the client's real number (not the placeholder).
- [ ] `robots.txt` and `sitemap.xml` on the live domain look right.
- [ ] Lighthouse mobile re-run on the live domain (target LCP < 2.5s on 4G).

## Content and claims (PRODUCT.md rules)

- [ ] No trust signal is shown that the client hasn't confirmed: licence number, association badge,
      testimonial, traveller count, years operating. Components stay empty until supplied.
- [ ] Every price renders with its `price_note` and the resident rate where it differs.
- [ ] No copy implies owned vehicles or in-house guides.
- [ ] Real package copy and images for the launch packages (all `media.alt` filled).
- [ ] Office address, hours, staff notification email supplied by the client.

## Ownership

- [ ] Domain and hosting accounts are in the client's name, or a handover is agreed in writing.
- [ ] Staff briefed on the pay-first flow: a customer pays at "Book now", **before** anyone checks
      availability with the supplier. `paid` means money received; staff verify with the supplier,
      mark the order `confirmed`, and refund promptly if the date can't be done.

## Hotelbeds

Detail and reasoning for each: `docs/hotelbeds_caveats.md`, section 3. None of this blocks development.

- [ ] **Commercial agreement signed with HBX Group, and certification passed** (CheckRate before booking, cancellation display, error handling, look-to-book). The test key never goes live; this is the gate to real hotel bookings.
- [ ] Production key and secret in the host's env, and **`HOTELBEDS_BASE_URL` set to the production host**. It defaults to the *test* host, so forgetting it books nothing real.
- [ ] A margin saved under **Hotel settings** in the admin (the `HOTEL_MARGIN_BPS` env var is only a fallback and should be removed or match).
- [ ] `pnpm migrate` run on the production DB with the hotel migrations (`packages_accommodation`, `destinations_hotel_destination`, `hotel_settings`, `hotel_supplier`); `pnpm migrate:status` clean. Do not rely on dev-mode push.
- [ ] **Resend configured, and a real staff alert seen.** A refused or unknown hotel booking alerts staff by email only; a refunded customer is told by email only.
- [ ] Staff know the unknown-booking procedure: search Hotelbeds for the order number (`clientReference`), and do not refund or rebook until checked.
- [ ] Look-to-book: decide whether the in-memory cache is enough for the production ratio; if not, restore the Postgres cache and call counters (commit `12a527b`).
- [ ] Taxes and fees payable at the hotel shown if a real rate carries them; the packaging-rate rule confirmed with Hotelbeds; photo and description usage terms read.
- [ ] Destination codes re-checked on the production host (Zanzibar returned nothing in the sandbox).
- [ ] The 2% booking price tolerance accepted, or set to 0.
- [ ] Hotel seed content removed (`pnpm seed:hotels`: land-only packages, the extra destinations, and the seven CC BY / CC BY-SA placeholder photos). Real land-only package prices set by staff, with lodging excluded from `priceFrom`.
- [ ] One real production hotel booking made, then cancelled through the admin refund.

## E2E run log

Record each full run here: date, environment, what was covered, what failed.

- **2026-10-15, local `next dev` + `stripe listen`, Stripe sandbox, branch `fix/webhook-inactive-order`.**
  Book now (name + email, no price from the browser) → Stripe Checkout showed KES 58,000.00 →
  paid with test card 4242 → `checkout.session.completed` delivered, 200 → booking page "Payment received",
  total paid KES 58,000.00 → receipt route 303 to Stripe's hosted receipt, bad token 404 → full refund via
  Stripe API → `charge.refunded` delivered, 200 → booking page "This booking was refunded".
  **Not covered:** emails (Resend env vars unset, so no-op), delayed-payment events, `checkout.session.expired`,
  live mode, the deployed webhook endpoint.
