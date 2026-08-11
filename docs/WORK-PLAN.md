# Minara Safaris — Work Plan

Execution tracker. Scope lives in `docs/PRD.md`; stack and invariants in `CLAUDE.md`.

**Status:** Pre-build — planning complete, nothing implemented.
**Last updated:** 2026-08-10

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
- [ ] Package catalogue — filters (destination, duration, price, tags) + sort
- [ ] Package detail — gallery, price block, itinerary, inclusions/exclusions
- [ ] Destination pages
- [ ] Articles list + detail
- [ ] Static pages incl. Contact with address, hours, map, `tel:` link
- [ ] 404 / error states

## Phase 4 — Conversion path

- [ ] WhatsApp deeplink with prefilled package name + URL
- [ ] Enquiry form — validation, package auto-fill from package pages
- [ ] `POST /api/leads` — honeypot, per-IP rate limit, time-to-submit check
- [ ] UTM/referrer capture persisted on the lead
- [ ] Resend notification to staff inbox — **verified end-to-end with a real send**
- [ ] Confirmation state after submit
- [ ] Leads inbox usable in Payload admin, status filter working

## Phase 5 — SEO, analytics, performance

- [ ] Per-page metadata from CMS fields; OG + Twitter cards
- [ ] `sitemap.xml`, `robots.txt`, canonical tags
- [ ] JSON-LD `TouristTrip` / `Product` on package pages
- [ ] Analytics installed
- [ ] **WhatsApp click tracked as a conversion event, with package slug** — launch blocker
- [ ] Form submission tracked as a conversion event
- [ ] Consent banner if GA4 chosen
- [ ] Lighthouse mobile: LCP < 2.5s on a real package page
- [ ] Accessibility pass — landmarks, alt text, focus states, contrast ≥ 4.5:1

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

## Decision log

| Date | Decision | Why |
|---|---|---|
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
