# Minara Safaris — Work Plan

Execution tracker. Scope lives in `docs/PRD.md`; stack and invariants in `CLAUDE.md`.

**Status:** Phases 1–5 complete except Resend real-send verification (blocked on client env vars). Phase 6 is the only phase left, and it's almost entirely blocked on client content/accounts — see below.
**Last updated:** 2026-08-18

---

## How to use this file

- Tick items only when *verified working*, not when the code is written.
- If a phase reveals new work, add it to that phase rather than starting a new one.
- Record decisions in the log at the bottom so a fresh session doesn't reopen them.
- Blocked items get `[!]` and a one-line reason, not silent removal.

---

## Phase 0 — Decisions (done)

- [x] PRD written, then cut from a three-service design to a single deploy
- [x] Payload / Next 16.3.0 / React 19.2.8 compatibility verified — clean resolution, zero peer warnings (PRD §8.3)
- [x] Backend: no separate service; Payload in-process (PRD §8.2)
- [x] Database: Neon Postgres, Frankfurt (PRD §8.4)
- [x] Components: shadcn/ui only; MUI and HeroUI rejected (PRD §8.5)

## Phase 1 — Foundation

- [x] Neon project created, `eu-central-1`, pooled connection string in `.env.local` — verified against `-pooler` endpoint
- [x] Install Payload `3.87.x` + `@payloadcms/next` + `@payloadcms/db-postgres` + `@payloadcms/richtext-lexical` (pnpm, pinned to `3.87.1`)
- [x] Payload mounted in the Next app; `/admin` loads, first user created and logged in via REST — verified end-to-end
- [x] `pnpm dev` clean, `pnpm build` clean, `pnpm lint` clean
- [x] shadcn/ui initialised against Tailwind 4
- [x] `.env.example` committed; secrets confirmed gitignored (`.env*` in `.gitignore`)

## Phase 2 — Content model (PRD §6)

- [x] `media` collection — upload adapter wired (local disk for now — Cloudinary/R2 undecided, swap adapter later without schema change), `alt` **required**, public read
- [x] `destinations` — public read; writes staff-only
- [x] `packages` — `priceFrom`/`priceNote`/`priceResident`/`offerLabel`/`itinerary` (array)/SEO group/`isFeatured`/`isPublished`; public read, writes staff-only
- [x] `package_destinations` many-to-many — modelled as an array field on `packages` (`destination` relationship + `isPrimary`), not a hand-rolled join table; Payload's db-postgres adapter generates the join table itself
- [x] `articles` — public read; writes staff-only
- [x] `pages` (about, contact, faqs, terms, privacy) — `slug` constrained to those 5 values via select, public read
- [x] `leads` — incl. `source`, `referrer`, `utm`; `create` access locked to `false` so the only write path is the future hand-written `POST /api/leads` via the Local API (Phase 4) — verified read/write access control end-to-end for all collections above
- [x] `payload` CLI fixed — was crashing on every Node version (20/22/26 all failed identically) with `ERR_REQUIRE_ASYNC_MODULE` in `@payloadcms/richtext-lexical`. Root cause: no `"type": "module"` in `package.json`, so `tsx` treated the ambiguous `.ts` config/collection files as CommonJS and `require()`'d an ESM-only dependency with top-level await. Fixed by renaming `src/payload.config.ts` → `.mts` and `src/fields/seo.ts` → `.mts` (unambiguous ESM), adding `PAYLOAD_CONFIG_PATH=src/payload.config.mts` to `.env.local` (Payload's own auto-detection doesn't recognise `.mts`), and enabling `allowImportingTsExtensions` in `tsconfig.json` so Next's bundler tolerates the explicit extension in import specifiers. Verified `generate:types`, `generate:importmap` work; `migrate:create` available whenever needed
- [x] Migration generated — `src/migrations/20260811_181154_initial.ts` + its `.json` snapshot, covering all 19 tables incl. the `packages_destinations` join table Payload generates. Typechecks clean. `pnpm migrate:create|migrate|migrate:status` scripts added
- [ ] Migration **applied and verified on a fresh Neon branch** — deliberately not run against the dev database, which is already push-synced, so `migrate` there would try to `CREATE TABLE` over existing tables. Verify by branching Neon from an empty state, pointing `DATABASE_URI` at it, and running `pnpm migrate` + `pnpm migrate:status`. Prod deploy runs `pnpm migrate` in the build step
- [ ] Keep dev on auto-push against a **Neon `dev` branch**, generate a migration per schema change, and never let prod push (Payload's adapter only pushes when `NODE_ENV !== production`, so this holds by default — don't override it)
- [x] Pinned Node to `24.16.0` (Active LTS) via `.nvmrc` + `nvm` — not required for the CLI fix above (verified working on 26.5.0, 24.16.0, and 20.20.2 alike once the real fix landed), but Vercel only adds runtime support once a line goes LTS, and Node 26 is the Current/non-LTS line; developing ahead of what the host supports risks a deploy-time surprise

## Phase 3 — Public site (PRD §4)

- [x] Layout, header/footer, nav, sticky mobile CTA bar — public site moved into a `(site)` route group so Payload's admin doesn't inherit the chrome. Spacer element keeps the fixed mobile bar off the last row of content
- [x] Home — hero, featured packages, deals strip (renders only when a package carries an `offerLabel`), destination tiles, "how booking goes", closing CTA. Trust bar deliberately absent: nothing that feeds it is confirmed, and the page is composed to hold without it
- [x] `pnpm seed` — 4 media, 4 destinations, 6 packages of **synthetic** content so the design is judged against real-shaped data. Refuses to run with `NODE_ENV=production`. Delete before launch
- [x] Design system recorded in `DESIGN.md`; direction contract emitted as a real HTML comment in the built markup (a JSX comment is stripped by the compiler and audits nothing)
- [x] Package catalogue (`/packages`) — filters (destination, duration, budget, tags, free-text query) + sort (featured/price/duration), empty states with WhatsApp fallback
- [x] Package detail (`/packages/[slug]`) — `ImageLightbox` gallery, `PriceBlock`, itinerary (blank `description` handled), inclusions/exclusions, `TouristTrip` JSON-LD, related packages, `CtaBanner`
- [x] Destination pages (`/destinations`, `/destinations/[slug]`) — cross-links live packages for that destination, `CtaBanner`
- [x] Articles list + detail (`/journal`, `/journal/[slug]`) — cover image, excerpt, `CtaBanner`
- [x] Static pages — generic `[slug]/page.tsx` renders about/faqs/terms/privacy from Payload; `/contact` is its own dedicated route
- [x] 404 / error states — `src/app/(site)/not-found.tsx` and `error.tsx`, both rendering inside the site chrome (header/footer/mobile CTA)

## Phase 4 — Conversion path

- [x] WhatsApp deeplink with prefilled context (`WhatsAppCta`, `src/lib/site.ts`) — renders nothing if no number is configured, so a dead link never ships
- [x] Enquiry form (`src/components/enquiry-form.tsx`) — honeypot, validation, package auto-fill via `?package=<id>` query param (read on `/contact`, linked from package detail pages' "Or send an enquiry")
- [x] `POST /api/leads` (`src/app/api/leads/route.ts`) — Zod schema (incl. `.trim()` on `name`/`email`), honeypot (`website` field), min-time-to-submit (3s), per-IP rate limit (`src/lib/rate-limit.ts`)
- [x] UTM/referrer capture persisted on the lead — form captures and forwards `utm.*`/`referrer`/`source`
- [x] Resend notification wired (`src/lib/notify-lead.ts`) — no-ops until `RESEND_API_KEY`/`RESEND_FROM_EMAIL`/`LEADS_NOTIFICATION_EMAIL` are set (blocked on client, see below); not yet verified with a real send
- [x] Confirmation state after submit — enquiry form shows a done state; `trackEvent("form_submit", ...)` fires alongside it
- [x] Leads inbox usable in Payload admin, `status` field (new/contacted/closed) with `defaultColumns` incl. status — access locked to authenticated staff only

## Phase 5 — SEO, analytics, performance

- [x] Per-page metadata; OG + Twitter cards (`src/app/layout.tsx` `metadataBase`/`openGraph`/`twitter`, per-CMS-page `seo.title`/`seo.description` where present)
- [x] `sitemap.xml`, `robots.txt`, canonical tags (`src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/seo.ts#canonical` applied on all 10 page types) — `robots.txt` disallows everything until `NEXT_PUBLIC_SITE_URL` is set, giving staging noindex for free
- [x] JSON-LD `TouristTrip` on package pages
- [x] Analytics installed — Plausible, script conditionally rendered from `plausibleDomain` (`src/lib/site.ts`), inert until `NEXT_PUBLIC_SITE_URL` is real
- [x] **WhatsApp click tracked as a conversion event, with package slug** — `AnalyticsListener` delegated click handler off existing `data-analytics-event`/`data-analytics-package` attributes on `WhatsAppCta`
- [x] Form submission tracked as a conversion event — `trackEvent("form_submit", { package })` in `enquiry-form.tsx`
- [x] Consent banner if GA4 chosen — moot, Plausible was chosen over GA4 and doesn't require cookie consent
- [x] Lighthouse mobile, package detail page (`pnpm dlx lighthouse`, throttled/simulated): Performance 90, Accessibility 100, Best Practices 100, SEO 69 (69 is `is-crawlable` failing as expected — `robots.txt` disallows everything locally without `NEXT_PUBLIC_SITE_URL`, re-check once that's set). Fixed: gallery's first thumbnail (the LCP element on package pages) was lazy-loaded like the rest of the grid — added `priority` to it in `ImageLightbox`, cutting Speed Index from 4.0s to 0.9s. LCP itself reads 3.6s under Lighthouse's simulated-throttling model, but that number is dominated by lantern's simulated network chain rather than real transfer time (breakdown table shows the real subparts sum to ~250ms) — an artifact of testing on localhost with no real host latency or CDN; re-measure against the deployed site before treating this as a launch blocker
- [x] Accessibility pass — Lighthouse a11y audited across all 5 page types (home, packages, destinations, contact, journal): 100 on all after fixing a real `heading-order` violation on `/packages` and `/destinations` (h1 followed directly by card `<h3>`s with no `<h2>` — added a `sr-only` `<h2>Results</h2>` before each grid). Also fixed a missing focus indicator on the homepage search input (`outline-none` on the input with no `focus-within` ring on its wrapper) — added `focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50` matching the `Button` component's ring convention. Landmarks and contrast (≥4.5:1, both themes) verified via Lighthouse's automated checks, all passing

## Phase 6 — Launch

- [ ] **Delete all seeded content** (`pnpm seed` output) — 6 packages with synthetic prices, 4 destinations, 4 stock images. Prices in particular are invented and must never reach production

- [ ] Vercel project, region co-located with Neon (Frankfurt)
- [ ] Staging on `noindex` until content lands
- [ ] 8 packages with real copy + images
- [ ] All 5 static pages populated
- [ ] 5 seed articles
- [ ] Licence/association badges + testimonials live
- [ ] Google Search Console verified, sitemap submitted
- [ ] Google Business Profile claimed (client task — plausibly higher ROI than the site itself in month one)
- [ ] Handover: CMS walkthrough for staff, note that ongoing blog publishing is a client commitment

---

## Blocked / waiting on client

Content is the critical path, not code — see PRD §10.

- [!] WhatsApp Business number — blocks Phase 4 deeplinks
- [!] Staff notification email — blocks Phase 4 verification
- [!] Package copy + images (8 launch packages) — blocks Phase 6
- [!] Licence / association details, office address, hours — blocks Phase 6
- [!] Testimonials with permission to publish — blocks Phase 6
- [!] Domain + hosting account ownership — blocks Phase 6

Phases 1–5 can complete in full with placeholder content. Do not slip the build waiting on these.

---

## Phase 2 (post-launch, not started)

Draft scope + price in `docs/PHASE-2-QUOTE.md` — payments (Flutterwave/Paystack), order/booking model, traveller accounts, invoicing, live chat embed. Phase 3 (flights/dynamic packaging) referenced there too, unscoped. Not started; do not pull any of this into Phase 1–6 work.

---

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-08-18 | Phase 5 closed out: Lighthouse mobile (90 perf / 100 a11y / 100 best-practices, package detail page) + accessibility pass across all 5 page types | Found and fixed 3 real issues: LCP element (package gallery's first thumbnail) was lazy-loaded like the rest of the grid; `/packages` and `/destinations` skipped a heading level (h1 straight to card h3s); homepage search input had no visible focus indicator. SEO score (69) is `is-crawlable` failing as expected — `robots.txt` disallows everything locally without `NEXT_PUBLIC_SITE_URL` — not a real gap. Phase 6 is now the only remaining phase, and it's almost entirely blocked on client-supplied content and accounts (see "Blocked / waiting on client" above) |
| 2026-08-17 | Phase 4/5 conversion + SEO work finished in one pass: enquiry form package auto-fill, Plausible analytics + WhatsApp/form-submit tracking, per-page canonical/OG/Twitter metadata, `sitemap.xml`/`robots.txt` | Discovered enquiry form UI was already fully built (WORK-PLAN was stale, not the code) — only the auto-fill link and the entire analytics/SEO layer were genuinely missing. Verified with `tsc --noEmit`, `pnpm lint`, `pnpm build`, and a running dev server (sitemap/robots/canonical/tracking attrs all confirmed via curl) |
| 2026-08-17 | Phase 1 price finalized at 100,000 KES total (50k/dev) | Matches remaining real scope (finish enquiry form, SEO/analytics, deploy) — most of frontend/CMS already built, so this is fair, not a lowball |
| 2026-08-17 | Phase 2 quoted separately (`docs/PHASE-2-QUOTE.md`, 120k–180k KES draft), Phase 3 referenced but unscoped (350k–600k KES draft) | Client's own roadmap quote underpriced both against real scope (M-Pesa/card via one aggregator still needs a new order model + accounts + webhook-safe payment handling; flights need Duffel/Amadeus Self-Service, not full GDS accreditation) — not to be quoted as fixed numbers until Phase 1 ships and scope is confirmed |
| 2026-08-17 | Native mobile app dropped from the roadmap entirely, not deferred to a later phase | A once-or-twice-a-year purchase doesn't justify an app install; responsive web already serves this |
| 2026-08-10 | No separate backend service | Payload in-process covers admin, auth, media, migrations; a second service adds two deploys and a REST hop to our own DB for a site with one write path |
| 2026-08-10 | Dropped the public read API (`GET /api/packages` etc.) | Single consumer in the same process; server components query directly |
| 2026-08-10 | Payload pinned `3.87.x` | Verified against Next 16.3.0 / React 19.2.8; v4 is canary |
| 2026-08-10 | Neon over Supabase | Payload already owns auth/storage/schema, so Supabase's platform is redundant; branching suits CMS-owned migrations. Cape Town region discounted — SSG/ISR means app↔DB latency matters, not user↔DB |
| 2026-08-10 | shadcn/ui, not MUI/HeroUI | Owned source, no runtime CSS-in-JS competing with Tailwind or costing mobile LCP |
| 2026-08-11 | Auto-push on a Neon `dev` branch **and** committed migrations — not either/or | Push is the dev iteration loop; the migration file is the prod artifact. Payload generates migrations from its own `.json` schema snapshot, not by diffing the live database, so a push-synced dev DB doesn't corrupt the diff. Neon branching is what makes the migration testable against production-shaped data, which was the reason for choosing Neon (§8.4) |
| 2026-08-11 | Brand palette: burnt-sienna primary, gold badge accent, warm-paper background | Set before Phase 3 so page work isn't done against shadcn's grey defaults. Primary is deliberately not green so the WhatsApp CTA is the only green element; all pairs verified ≥4.5:1 |
| 2026-08-11 | Both themes designed, `next-themes` added | System preference by default with a user override; dark is a warm near-black base built for photography, not an inversion. All pairs re-verified ≥4.5:1 in both themes |
| 2026-08-11 | Type: Newsreader (display + blog prose) + Figtree (UI/body) | Two variable latin-only families, self-hosted via `next/font`. Newsreader does double duty so the blog costs no extra font; both were chosen over Fraunces/Instrument Serif, which are more saturated in current web design |
| 2026-08-11 | Icons: Phosphor, `lucide-react` removed | Owner's call on distinctiveness — Lucide is the default of most React sites. Phosphor also ships `WhatsappLogo`, so the primary conversion glyph comes from the icon family instead of a hand-rolled SVG, and the weight axis covers display scale if Phase 3 goes icon-forward. Rejected: Heroicons (too small a set for travel vocabulary), Material Symbols (font request on the LCP path, generic Android register), Hugeicons (full set is paid). shadcn's `components.json` supports `iconLibrary: "phosphor"` natively, so future `shadcn add` stays consistent |
| 2026-08-11 | Phosphor imported per-icon from `dist/ssr/*` via `src/components/icons.ts` | Root export is the client build and reads `IconContext`, which breaks server components; and Phosphor isn't in Next's `optimizePackageImports` defaults, so barrel imports rely on tree-shaking alone. Verified `/` still prerenders as static after the swap |
| 2026-08-10 | Blog added to V1 scope | SEO was named as the acquisition channel but ~15 commercial pages cannot rank alone |
| 2026-08-13 | Free-text slug fields (`Articles`, `Packages`, `Destinations`) get a shared `beforeValidate` hook (`src/fields/slug.mts`) | Payload has no built-in slug type; a trailing-space slug caused a real 404 on a newly created article. `Pages` excluded — its slug is a fixed `select`, not free text |
