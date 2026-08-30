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
| Email | Resend |
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

## Conventions

- pnpm for everything. Never npm.
- Colour comes from the tokens in `src/app/globals.css` — never a raw hex or a Tailwind palette class (`bg-orange-600`) in a component. `--gold` is offer/deal badges only; `--accent` is hover/subtle surfaces; `--whatsapp` is the WhatsApp CTA only. Primary is warm sienna, not green, so green reads as "this is the WhatsApp button". Both themes are designed and contrast-verified; on dark, foreground on primary/gold/whatsapp is ink, not white.
- Type roles are tokens, not ad-hoc sizes: `text-display`, `text-title`, `text-heading`, `text-lead`, `text-label`. Newsreader (`font-heading`/`font-serif`) for headings and blog prose, Figtree (`font-sans`) for UI and body. Two families, no third.
- Icons: import from `@/components/icons`, never from `@phosphor-icons/react` directly. The root export is the client build and reads `IconContext`, so it breaks server components; `icons.ts` re-exports the per-icon `dist/ssr/*` build instead. Deep paths also matter because Phosphor isn't in Next's `optimizePackageImports` defaults, so a barrel import has nothing but tree-shaking protecting the bundle. `weight="regular"` for 16–20px metadata glyphs, `weight="fill"` for brand marks and 32px+.
- Touch targets ≥44px. `Button` `size="cta"` exists because shadcn's scale tops out at 36px.
- Public pages live in `src/app/(site)/`, which owns the header/footer/mobile-CTA shell. The root layout is html/body/fonts/theme only, so Payload's `(payload)` admin doesn't inherit site chrome.
- Images are capped at 2400px/q82 in two places that must stay in sync: `Media.upload.resizeOptions` (admin uploads, sharp in-process, runs before the file reaches R2) and `pnpm optimize:images` (local files in `public/images`). No `imageSizes` variants — next/image owns delivery sizing, and R2 transforms nothing.
- Money is rendered by `PriceBlock` and nothing else — that's what makes "never a bare price" structural rather than a habit. Server reads go through `src/lib/content.ts` (Payload local API), never `fetch`.
- Scope discipline is the point of this project. If a request sounds like Phase 2 (payments, accounts, booking, reviews, multi-currency), check PRD §9 before building it.
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

Phases 1–5 done: shell, home, catalogue, package/destination/article detail, static pages, 404/error states, enquiry form (incl. package auto-fill via `?package=<id>`), `POST /api/leads`, canonical/OG/Twitter metadata, `sitemap.xml`/`robots.txt` (staging noindex by default until `NEXT_PUBLIC_SITE_URL` is set), Plausible analytics with WhatsApp-click and form-submit conversion tracking, Lighthouse mobile (90 perf / 100 a11y / 100 best-practices on package detail) and an accessibility pass across all page types. Resend wired but no-op until client env vars land — real-send unverified. Phase 6 (deploy + client content) is all that's left. Seeded with synthetic content via `pnpm seed` (delete before launch). `DESIGN.md` records the visual system. The original static-HTML prototype lives in `legacy/`.

Phase 1 priced at 100,000 KES (50k/dev), finalized 2026-08-17 — covers finishing Phase 4–6 above, nothing further. Phase 2 (payments, order model, traveller accounts) draft-quoted separately in `docs/PHASE-2-QUOTE.md`; Phase 3 (flights) referenced there but unscoped. Neither is being built now — see PRD §9 before touching anything payments/accounts/booking-shaped.
