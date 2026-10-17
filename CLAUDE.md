@AGENTS.md

# Minara Safaris

Lead-generation website for a Kenyan/East African safari & tour operator, modelled on bonfireadventures.co.ke. Visitors browse packages and destinations; **every conversion is a handoff to a human agent** via WhatsApp deeplink or an enquiry form. No payments, no accounts, no booking engine — see `docs/PRD.md` §2 for the full non-goals list.

`docs/PRD.md` is the source of truth for scope. `docs/WORK-PLAN.md` tracks execution. `PRODUCT.md` holds durable product truth — audience, positioning, what may and may not be claimed. This file is the fast orientation.

## Stack (decided, do not re-litigate)

| Layer | Choice |
|---|---|
| App | Next.js 16.3.0, App Router, SSG/ISR |
| UI | React 19.2.8, Tailwind 4, TypeScript 5 |
| CMS + backend | Payload CMS, pinned `3.87.x`, mounted **inside** the Next app |
| Database | Postgres on Neon, `eu-central-1` (Frankfurt) |
| Components | shadcn/ui (copied source, Radix underneath) |
| Icons | Phosphor (`@phosphor-icons/react`), via the curated re-export in `src/components/icons.ts` |
| Type | Newsreader + Figtree, variable, latin-only, self-hosted via `next/font/google` |
| Theming | `next-themes`, class strategy, system default — both themes are designed, not inverted |
| Media | Cloudflare R2 (S3-compatible, `@payloadcms/storage-s3`) via `next/image` — decided over Cloudinary; Next's own Image Optimization API already handles resizing, so Cloudinary's transform pipeline added nothing |
| Email | Formspree for enquiry notifications (forwarded server-side from `POST /api/leads`, `FORMSPREE_FORM_ID`); Resend for booking confirmations, which need a customer recipient and a PDF attachment |
| Exchange rates | exchangerate-api.com, KES base, cached 24h via `fetch` revalidate (`src/lib/exchange-rates.ts`) — never fetched per visit or from the browser |
| Hotels | Hotelbeds APItude, server-side only (`src/lib/hotelbeds.ts`). Test host by default; the account quotes **EUR only**, converted to KES/USD with `eurToDisplay` (rounds up). Margin is the staff-editable `hotel-settings` global (env `HOTEL_MARGIN_BPS` is only the fallback until it's saved); lookups are cached in memory only, deliberately, at current scale |
| Analytics | Plausible (preferred) or GA4 |
| Validation | Zod, at the `POST /api/leads` trust boundary only — not for CMS-shaped data, which Payload already validates/types |
| Package manager | pnpm |
| Node | `24.16.0` (Active LTS), pinned via `.nvmrc`/`nvm` — Vercel only supports LTS lines; don't develop ahead of that |

**There is no separate backend service.** Payload runs in the Next process and owns schema, migrations, staff auth, media, and the admin UI. Server components query it directly via the local API. Rejected with reasons in PRD §8.2: Fastify/Nest, Spring Boot, Go, Django, Refine, react-admin.

**The only hand-written public endpoint is `POST /api/leads`.** No REST layer between our own server and our own database.

Payload/Next 16 compatibility was verified 2026-08-10 (PRD §8.3). Payload 4 is canary — do not upgrade mid-build.

## Constraints that are easy to violate

- **Never render a bare price.** `price_from` must always ship with `price_note` ("per person sharing, low season") and the resident rate where it differs. Bare numbers generate bad-fit enquiries.
- **WhatsApp clicks must fire a tracked analytics event.** The primary conversion leaves the site; untracked, we cannot tell whether any of this works. Launch blocker.
- **Never invent a trust signal.** No licence number, association badge, testimonial, traveller count, or years-operating figure is confirmed (PRD §4.7). Build the components, leave them empty. Stock *imagery* is fine during development; stock *claims* are not — a fake badge is the one placeholder nobody can spot later. Minara is currently an intermediary: no copy may imply owned vehicles or in-house guides.
- **`media.alt` is required, not optional.** Accessibility baseline.
- **Mobile-first on metered data.** LCP < 2.5s on 4G. Every image through `next/image`. This is why MUI/HeroUI were rejected — runtime CSS-in-JS duplicating Tailwind.
- **The enquiry form is a public unauthenticated POST.** Honeypot + rate limit + time-to-submit are requirements, not polish.
- SEO is the acquisition channel — per-page editable title/description/OG, JSON-LD on packages, and the blog (§4.6) is the strategy, not a nice-to-have.
- **Payload config and anything it imports with top-level await must be `.mts`, not `.ts`.** With no `"type": "module"` in `package.json`, the `payload` CLI's `tsx` loader treats ambiguous `.ts` files as CommonJS and `require()`s them — which crashes on `@payloadcms/richtext-lexical`'s ESM/top-level-await export. `payload.config.mts` and `src/fields/seo.mts` are `.mts` for this reason; new files in that import chain need the same treatment (or `PAYLOAD_CONFIG_PATH`/`allowImportingTsExtensions` need revisiting).
- **Hotelbeds look-to-book is contractual.** Search only on an explicit submit with dates, never on page load or in a carousel; identical lookups go through the in-memory cache in `hotel-search.ts`; never book without a preceding CheckRate; `rateKey` is opaque (no trim, parse or re-encode). `/api/hotels/*` need the anonymous session cookie (`hotel-session.ts`), and net prices never leave the server. Live hotel prices render via `HotelPrice`, never bare. Packaging and pay-at-hotel rates are not sold. After payment the webhook books under our order number; **never refund or rebook on an ambiguous Hotelbeds result** (a 500 can mean it worked), settle it by reading the booking back or looking it up by `clientReference`, and leave `unknown` to a human.
- **Money is integer minor units past `src/lib/money.ts`.** Floats only where a human typed a price into the admin. And only the Stripe webhook may write `status: "paid"` on an order — no other code path, ever.

## Conventions

- pnpm for everything. Never npm.
- Colour comes from the tokens in `src/app/globals.css` — never a raw hex or a Tailwind palette class (`bg-orange-600`) in a component. `--gold` is offer/deal badges only; `--accent` is hover/subtle surfaces; `--whatsapp` is the WhatsApp CTA only. Primary is warm sienna, not green, so green reads as "this is the WhatsApp button". Both themes are designed and contrast-verified; on dark, foreground on primary/gold/whatsapp is ink, not white.
- Type roles are tokens, not ad-hoc sizes: `text-display`, `text-title`, `text-heading`, `text-lead`, `text-label`. Newsreader (`font-heading`/`font-serif`) for headings and blog prose, Figtree (`font-sans`) for UI and body. Two families, no third.
- Icons: import from `@/components/icons`, never from `@phosphor-icons/react` directly. The root export is the client build and reads `IconContext`, so it breaks server components; `icons.ts` re-exports the per-icon `dist/ssr/*` build instead. Deep paths also matter because Phosphor isn't in Next's `optimizePackageImports` defaults, so a barrel import has nothing but tree-shaking protecting the bundle. `weight="regular"` for 16–20px metadata glyphs, `weight="fill"` for brand marks and 32px+.
- Touch targets ≥44px. `Button` `size="cta"` exists because shadcn's scale tops out at 36px.
- Public pages live in `src/app/(site)/`, which owns the header/footer/mobile-CTA shell. The root layout is html/body/fonts/theme only, so Payload's `(payload)` admin doesn't inherit site chrome.
- Images are capped at 2400px/q82 in two places that must stay in sync: `Media.upload.resizeOptions` (admin uploads, sharp in-process, runs before the file reaches R2) and `pnpm optimize:images` (local files in `public/images`). No `imageSizes` variants — next/image owns delivery sizing, and R2 transforms nothing.
- KES/USD conversion goes through `convertPrice` only — display (`DisplayPrice`) and `POST /api/checkout` share it so the charged figure equals the shown one. The browser sends a currency code, never a rate. Preference is localStorage, not a cookie, to keep pages static.
- Palettes: Sunset (default, no attribute) and Ocean (`data-palette="ocean"` on `<html>`, set pre-paint by `PALETTE_SCRIPT`). Ocean overrides must be scoped `:not(.dark)` / `.dark` or they outrank dark mode.
- Money in the catalogue (package/destination pages) is rendered by `PriceBlock` and nothing else. Settled order figures (the booking page, confirmation email) render via `formatMoney` from `src/lib/money.ts` instead — a fixed historical amount is a different thing from a live catalogue price, and doesn't carry `price_note`/resident-rate context. Server reads go through `src/lib/content.ts` (Payload local API), never `fetch`.
- Scope discipline is the point of this project. If a request sounds like Phase 2 (accounts, reviews, currencies beyond KES/USD), check PRD §9 before building it.
- Prefer deleting to adding. The PRD was already cut down once from a three-service design.
- Free-text slug fields (`Articles`, `Packages`, `Destinations`) use the shared `slugField()` factory (`src/fields/slug.mts`), a `beforeValidate` hook that auto-fills from the source field and normalizes whatever's typed — Payload has no built-in slug type. `Pages` is excluded; its slug is a fixed `select`, not free text.

## Self-update protocol

Keep this file current as work lands. Update it when — and only when — one of these changes:

1. **A stack decision changes or a dependency is added** → update the table and note why in one line.
2. **A constraint is discovered the hard way** (a bug caused by violating an invariant) → add it to "Constraints that are easy to violate".
3. **A convention is established** (file layout, naming, a pattern we settled on) → add to Conventions.
4. **Scope moves between V1 and Phase 2** → update PRD §2/§9 first, then reflect it here in one line.

Do not log completed work here — that belongs in `docs/WORK-PLAN.md`. Do not restate the PRD. If this file grows past roughly 100 lines, cut it back; it is loaded into every session and long context is worse than no context.

## Status

Phases 1–5 done: shell, home, catalogue, package/destination/article detail, static pages, 404/error states, enquiry form (incl. package auto-fill via `?package=<id>`), `POST /api/leads`, canonical/OG/Twitter metadata, `sitemap.xml`/`robots.txt` (staging noindex by default until `NEXT_PUBLIC_SITE_URL` is set), Plausible analytics with WhatsApp-click and form-submit conversion tracking, Lighthouse mobile (90 perf / 100 a11y / 100 best-practices on package detail) and an accessibility pass across all page types. Enquiry emails go via Formspree (verified with a real submission 2026-10-15); booking-confirmation email via Resend is no-op until its env vars land. Seeded with synthetic content via `pnpm seed` (delete before launch). `DESIGN.md` records the visual system. The original static-HTML prototype lives in `legacy/`.

Payments and orders (Spec Part A, `docs/SPEC-PAYMENTS-HOTELS.md`) have shipped: an `Orders`/`ProcessedEvents` Payload schema with a real applied Postgres migration, server-computed pricing (`src/lib/pricing.ts`), a Stripe Checkout endpoint (`POST /api/checkout`) where the browser sends only an id and quantity, never a price, a signature-verified idempotent webhook (`POST /api/webhooks/stripe`) as the sole path to `status: "paid"`, a private booking page behind a hashed access token (`/booking/[token]`), a confirmation email (no-op until Resend env vars land, same as leads), and a `beforeChange` hook that freezes a paid order's figures against further edits. The purchase entry point (`BookingForm`, a "Book now" call-to-action on package detail pages, `adults`+`children` combine into `quantity` — no child-rate tier exists yet, so both price the same) is wired to `POST /api/checkout`. Customers get Stripe's hosted receipt (`GET /api/booking/[token]/receipt`, a 303 redirect for paid/confirmed/refunded orders), not an invoice — they pay up front, so proof of payment is the document; Stripe receipts cost nothing, while `invoice_creation` charged per invoice. Our own PDFs come back only if the accountant's UK VAT/TOMS answer requires wording Stripe can't carry. The webhook handles completed, delayed-success, delayed-failure, expiry and refund events; all five must be subscribed on the Stripe endpoint. `paid` means money received; `confirmed` means staff verified availability with the supplier, and the booking page and email say so. Hotels (Hotelbeds, Spec Part B) sell standalone at `/hotels` or bundled with a "choose your own hotel" package (`/hotels?package=<id>`): one Stripe payment, two order items, and a hotel Hotelbeds refuses is refunded for its own subtotal only (`src/lib/order-parts.ts`, `refund.ts`); a bundle is never auto-`confirmed`. Tracker: `docs/hotelbeds_caveats.md`. `pnpm test` runs Vitest (`vitest.config.mts`, `.mts` for the same ESM reason as the Payload config).

Phase 1 priced at 100,000 KES (50k/dev), finalized 2026-08-17 — covers finishing Phase 4–6 above, nothing further. Phase 2 (payments, order model, traveller accounts) was draft-quoted separately in `docs/PHASE-2-QUOTE.md`; that quote and PRD §9's "not being built now" framing predate the payments-and-orders work above and are stale on that point — `docs/SPEC-PAYMENTS-HOTELS.md` is the current authority for what's actually shipping. PRD §2/§9 themselves have not been reconciled with this decision; do that before treating them as current on payments/accounts/booking scope. Phase 3 (flights) is still unscoped and not being built.
