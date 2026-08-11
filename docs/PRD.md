# Minara Safaris — Website PRD (V1)

**Status:** Draft for internal build — team-defined scope, not the client's original spec
**Revision:** V2 (2026-08-10) — collapses the separate backend/admin build into a single Next.js + CMS deploy, adds SEO/content and measurement requirements that V1 assumed but never specified. Stack is now decided and version-verified (§8); no open technical blockers.
**Model:** Content + lead-generation site, styled after bonfireadventures.co.ke. No payments, no accounts, no booking engine. Every enquiry converts to a human conversation on WhatsApp or email.
**Team:** 2 developers.

---

## 1. Goal & Success Criteria

Give Minara Safaris a professional website where a visitor can browse tour/safari packages and destinations, then contact an agent to book — by WhatsApp deeplink or a contact/enquiry form. No self-serve checkout at this stage.

**How we know it worked** (measured from launch + 90 days):

| Metric | Target |
|---|---|
| Qualified enquiries per week (form + tracked WhatsApp clicks) | 15 |
| WhatsApp click-through rate on package detail pages | ≥ 5% of page views |
| Organic sessions per month by month 3 | 1,500 |
| Largest Contentful Paint on package pages, mobile 4G | < 2.5s |

If we cannot report these numbers on launch day, the analytics requirement (§4.8) is not done.

**Launch criteria** — all of: 8 published packages with real copy and images, all 5 static pages populated, enquiry form delivering to the staff inbox and verified end-to-end, sitemap submitted to Google Search Console, Google Business Profile claimed.

## 2. Non-Goals (explicitly out of scope for V1)

Do not build any of the following. If asked "where's X", the answer is "Phase 2, not V1":

- User accounts / login / customer dashboard
- Payments of any kind (Stripe, M-Pesa, wallet)
- Booking/cart/checkout flow, availability holds, booking lifecycle states
- Park fee calculation engine, permits, quota tracking
- Hotel search/aggregation, flights, transfers as bookable products
- Custom trip builder / quote workflow inside the app
- Reviews system (start with static/manually-entered testimonials — see §4.7)
- Multi-language, multi-currency (see §6 note on price display)
- Mobile app (native or otherwise) — web only, responsive
- Supplier portal, agent portal, operations console beyond the CMS
- **A bespoke admin panel or a separate backend service** — see §8. This was in the previous revision and is now explicitly out of scope.

## 3. Users & Roles

| Role | Access |
|---|---|
| **Visitor** | Public site only. No login. |
| **Staff/Admin** | Logs into the CMS admin. Manages packages, destinations, articles, media, and views submitted enquiries. |

No role hierarchy for V1 — all staff get equal admin access. Granular roles are a CMS config change later if the client asks.

## 4. Functional Requirements — Public Site

### 4.1 Home page
- Hero section with rotating/static imagery and a headline.
- Featured/highlighted packages (staff-selected via the `featured` flag).
- Current offers/deals strip — reuses `featured` packages with an optional `offer_label` (e.g. "Easter Special"). Deals drive the homepage in this market; don't leave the fold static.
- Destination tiles (linking to a filtered package list per destination).
- Trust bar: licence/association memberships, years operating, traveller count (§4.7).
- "Book on WhatsApp" and "Enquire" calls to action, visible above the fold.

### 4.2 Package catalogue (listing page)
- Grid/list of all published packages.
- Filters: destination, duration, price range, trip style (tag-based — see §6).
- Sort: price, duration, newest.
- Each card: cover image, title, destination, duration, starting price *with its price note* (§6), short teaser.

### 4.3 Package detail page
- Image gallery.
- Title, destination(s), duration.
- **Price block:** `price_from` + `price_note` + resident/non-resident rates where they differ. Never render a bare number — "KES 45,000" without "per person sharing, non-resident, low season" generates bad-fit enquiries and burns agent time.
- Full description / itinerary (day-by-day, structured — see §6).
- Inclusions / exclusions lists.
- Two CTAs, always visible (sticky on scroll for long pages):
    - **WhatsApp button** → deeplink `https://wa.me/<number>?text=<prefilled message with package name + URL>`. Must fire a tracked analytics event (§4.8).
    - **Enquiry form** (see §4.5)
- `tel:` link to the office line — a meaningful share of customers will call rather than type.
- JSON-LD structured data (`TouristTrip` / `Product` with `offers`) — cheap, and most competitors omit it.

### 4.4 Destination pages
- One page per destination (Kenya, Tanzania, Zanzibar, etc.).
- Short overview text (staff-editable), cover image, SEO fields.
- List of packages tagged to that destination (reuses catalogue listing, filtered).

### 4.5 Enquiry form
- Fields: name, email, phone, package (auto-filled if launched from a package page, otherwise a dropdown/search), preferred travel dates (optional, free text), number of travellers, message.
- **Anti-spam, required not optional:** honeypot field + server-side rate limit per IP (e.g. 5/hour) + minimum time-to-submit check. A public unauthenticated POST endpoint attracts bots within days of indexing. No CAPTCHA unless the honeypot proves insufficient.
- **Attribution capture:** persist `source`, `referrer`, and any `utm_*` params alongside the submission. Without this we cannot answer "which packages generate enquiries", which is the only genuinely useful question the lead data can answer.
- On submit: store as a `Lead` record (§6) **and** send a notification email to the staff inbox. WhatsApp notification is a nice-to-have, not required for V1.
- Show a confirmation message after submit. No customer-facing account or ticket tracking — staff follow up manually.

### 4.6 Articles / blog
- Listing page + article detail page. Author, publish date, cover image, rich body, tags, related packages.
- **Rationale, since this was previously absent:** §4.9 names organic search as the acquisition channel, but the ~15 commercial pages in §4.1–4.4 cannot rank alone. Competitors rank on informational queries — "best time to visit Masai Mara", "Kenya safari packing list", "Amboseli vs Tsavo". The blog *is* the SEO strategy; without it the SEO requirement is aspirational.
- V1 ships the template + 5 seed articles. Ongoing publishing is a client/marketing commitment, not a dev deliverable — flag this explicitly at handover.

### 4.7 Trust & static content
- About, Contact, FAQs, Terms, Privacy Policy.
- **Contact page must carry:** physical office address, phone numbers, WhatsApp link, email, office hours, embedded map. Address matters for both trust and local SEO.
- **Trust signals, treated as a requirement not decoration:** KATO / TRA (or equivalent) membership badges and licence numbers, company registration, testimonials with names and photos. Travel scams are common enough in this market that an anonymous site with only a WhatsApp number converts poorly. Client must supply licence details — see §10.
- **[!] Status 2026-08-11 — none of the above is confirmed.** No licence number, no association membership, no testimonial, no traveller count, no years-operating figure. Build the components and leave them unpopulated; **do not fabricate a badge, a statistic, or a testimonial, including as placeholder copy.** An invented trust signal is the one placeholder that cannot be safely swapped later, because nobody can tell by looking that it was fake.
  - Stock imagery *is* acceptable during development so the design and admin can be finished, and is replaced with real photography before launch. Imagery is a placeholder; claims are not.
  - Minara currently operates as an **intermediary** — it does not own vehicles or employ its guides. No copy or imagery may imply an owned fleet or in-house guiding team.
  - A logo exists but is provisional. Don't build an identity that breaks if it changes.
  - Launch gate: if licence and association details have not landed, the trust bar ships with only what is true (contact details, physical address, company name) rather than with filler.
- Managed via the CMS's generic Page type — no editorial workflow, no versioning.

### 4.8 Analytics & measurement
- Plausible or GA4 on all pages.
- **Outbound WhatsApp clicks tracked as a conversion event**, with the package slug as a property. The primary conversion path leaves the site; untracked, we have no way to know whether the site works. This is a launch blocker, not a follow-up.
- Form submissions tracked as a conversion event.
- Google Search Console verified, sitemap submitted.
- If GA4 is chosen and the site takes UK/EU traffic, ship a one-line consent banner. This is a banner, not a compliance programme.

### 4.9 Cross-cutting
- Fully responsive, mobile-first — most traffic will be mobile, much of it on metered data.
- **Performance budget:** `next/image` with AVIF/WebP for every image, CDN-served, LCP < 2.5s on mobile 4G. A gallery-heavy safari site on Kenyan mobile data fails silently if this is discovered at launch rather than designed in.
- SEO: per-page editable title/meta description/OG image, clean URLs, `sitemap.xml`, `robots.txt`, canonical tags, Open Graph + Twitter cards.
- Accessibility baseline: semantic landmarks, alt text on all content images (CMS field is required, not optional), visible focus states, form labels and error messages, colour contrast ≥ 4.5:1.

## 5. Admin

No custom admin panel is built. Staff use the CMS's own admin UI, which provides — with zero build cost — authentication, user management, CRUD for all content types, media upload and picking, draft/publish state, and a read/filter view over submitted leads.

Requirements the CMS config must satisfy:

- **5.1 Auth:** email/password login for staff, rate-limited. No 2FA, no permissions matrix for V1.
- **5.2 Packages:** all fields in §6, with draft/published and featured toggles.
- **5.3 Destinations:** name, slug, overview, cover image, SEO fields.
- **5.4 Articles:** title, slug, body, cover, tags, related packages, publish date.
- **5.5 Pages:** slug + title + rich body for About/FAQs/Terms/Privacy.
- **5.6 Leads inbox:** newest-first list, filter by status (New / Contacted / Closed), full submission detail, manual status update. No assignment, no pipeline, no automation.
- **5.7 Media:** upload-and-pick widget with a required alt-text field. No dedicated media library UI beyond what the CMS ships.

## 6. Content Model

The CMS owns schema generation against Postgres; this is the intended shape, and the reference if we ever swap the CMS out.

```
packages
  id              uuid pk
  slug            text unique
  title           text
  duration_days   int
  price_from      numeric
  price_note      text        -- REQUIRED in the UI: "per person sharing, low season" etc.
  price_resident  numeric nullable   -- KE/EA resident rate where it differs
  currency        text default 'KES'
  offer_label     text nullable      -- "Easter Special", drives the homepage deals strip
  summary         text            -- short teaser for cards
  description     richtext        -- long-form body
  itinerary       jsonb           -- [{day, title, description}] — days are never queried
                                  --   independently of their package, so no separate table
  inclusions      text[]
  exclusions      text[]
  tags            text[]          -- trip style: safari, beach, honeymoon, family, etc.
  is_featured     bool default false
  is_published    bool default false
  seo_title       text
  seo_description text
  og_image        uuid fk -> media.id
  created_at      timestamptz
  updated_at      timestamptz

package_destinations              -- join table from day one: Kenya+Tanzania combo tours
  package_id      uuid fk -> packages.id      --   are a real product here, and retrofitting
  destination_id  uuid fk -> destinations.id  --   this later is worse than an under-used table
  is_primary      bool default false
  pk (package_id, destination_id)

package_images
  id          uuid pk
  package_id  uuid fk -> packages.id
  media_id    uuid fk -> media.id
  sort_order  int
  is_cover    bool default false

destinations
  id              uuid pk
  slug            text unique
  name            text
  overview        richtext
  cover_image     uuid fk -> media.id
  seo_title       text
  seo_description text
  created_at      timestamptz

articles
  id              uuid pk
  slug            text unique
  title           text
  excerpt         text
  body            richtext
  cover_image     uuid fk -> media.id
  tags            text[]
  published_at    timestamptz nullable
  seo_title       text
  seo_description text

leads
  id            uuid pk
  name          text
  email         text
  phone         text
  package_id    uuid fk -> packages.id, nullable
  travel_dates  text          -- free text for V1, structured later if needed
  travellers    int
  message       text
  status        text default 'new'   -- new | contacted | closed
  source        text          -- landing page path
  referrer      text
  utm           jsonb         -- {source, medium, campaign}
  created_at    timestamptz

pages
  id          uuid pk
  slug        text unique     -- 'about', 'faqs', 'terms', 'privacy', 'contact'
  title       text
  body        richtext
  seo_title       text
  seo_description text
  updated_at  timestamptz

media
  id          uuid pk
  url         text
  alt         text not null   -- required: accessibility baseline, §4.9
  width       int
  height      int

staff_users     -- provided by the CMS; listed for completeness only
  id, email, password_hash, created_at
```

**Currency note:** multi-currency is out of scope, but packages targeting international visitors will need USD. V1 stores one price in one currency with a free-text note; if the client needs dual display, add a `price_from_usd` column rather than a conversion engine.

## 7. API Surface

Public:
```
POST /api/leads                    -- enquiry form submission. The only public write endpoint.
GET  /sitemap.xml
GET  /robots.txt
```

That is the entire hand-written API surface.

Page data is fetched server-side in Next.js server components, querying the database directly through the CMS's local API. The previous revision specified `GET /api/packages`, `/api/destinations`, `/api/pages` and a full `/api/admin/*` CRUD suite — those existed to serve a frontend running in the same process, and a second REST hop between our own server and our own database buys nothing. Admin CRUD is the CMS's own API, which we do not write, document, or maintain.

If a second consumer ever appears (mobile app, partner feed), add a read API then, shaped by that consumer's actual needs.

## 8. Tech Stack

### 8.1 Decided

| Layer | Choice | Version |
|---|---|---|
| App framework | Next.js (App Router), SSG/ISR | `16.3.0` |
| UI runtime | React / React DOM | `19.2.8` |
| Styling | Tailwind CSS | `4.x` |
| Language | TypeScript | `5.x` |
| CMS + backend | Payload CMS, mounted inside the Next app | pin `3.87.x` |
| Database | Postgres on **Neon**, region `eu-central-1` (Frankfurt) | — |
| DB adapter | `@payloadcms/db-postgres` | `3.87.1` |
| Rich text | `@payloadcms/richtext-lexical` | `3.87.1` |
| Components | shadcn/ui (Radix primitives, copied into repo) | — |
| Media | Cloudinary or R2, served via `next/image` | — |
| Email | Resend | — |
| Analytics | Plausible (preferred — no consent banner) or GA4 | — |
| Hosting | Vercel, app region co-located with Neon (Frankfurt) | — |
| Package manager | pnpm | `11.11.0` |

### 8.2 No separate backend service

Payload **is** the backend. It runs in the Next.js process, owns the schema, generates Drizzle-backed migrations, ships staff authentication, and exposes a typed local API that server components call directly.

We are not adding Node/Fastify, Spring Boot, Go, or Django alongside it. Doing so would mean two languages, two deploys, and a hand-written REST hop between our own server and our own database, for a site whose only write path is a contact form. Spring Boot and Go earn their boilerplate at throughput we will never see here; Django's admin is excellent but would mean Python plus TypeScript and an API between them.

Refine and react-admin were also considered and rejected: they replace the admin *UI* but leave us writing the API, auth, migrations, and media pipeline that Payload already provides. Strictly more work for strictly less.

Revisit only if Phase 2 payments genuinely require a separate service — and then it is one service, not a re-platform.

### 8.3 Payload / Next 16 compatibility — verified 2026-08-10

The previous revision flagged this as blocking. **It is cleared.** Payload `3.87.1` peer ranges against this repo's exact versions:

| Peer | Declared range | Ours | |
|---|---|---|---|
| `next` | `>=16.2.6 <17.0.0` | `16.3.0` | pass |
| `react` / `react-dom` | `^19.0.1 \|\| ^19.1.2 \|\| ^19.2.1` | `19.2.8` | pass |
| `node` | `^18.20.2 \|\| >=20.9.0` | — | pass |

A full `pnpm add --lockfile-only` of `payload`, `@payloadcms/next`, `@payloadcms/db-postgres`, `@payloadcms/richtext-lexical`, `graphql` resolved with zero peer warnings.

Pin to `3.87.x`. Payload 4 is in canary — do not chase it mid-build. The Directus fallback named in the previous revision is no longer needed and is dropped.

### 8.4 Why Neon over Supabase

Supabase's value is the platform *around* Postgres — auth, RLS, storage, realtime, the PostgREST auto-API. In this stack Payload owns auth and access control, Cloudinary/R2 owns media, and server components query directly, so none of it applies. Worse, Payload's migrations expect to own the schema, which sits awkwardly beside a dashboard-driven workflow that thinks it does too.

Given we only need a good managed Postgres, Neon wins on:

- **Branching** — git-style database branches, so every Payload schema migration is tested against production-shaped data before it reaches prod. With a CMS that owns the schema, this gets used constantly.
- **Scale-to-zero without a penalty** — pages are SSG/ISR, so the database is hit at build and revalidation, never on the visitor request path. A cold start costs a background revalidation a few hundred ms and costs users nothing. Supabase's free tier *pauses* projects after a week of inactivity, a worse failure mode.
- **Pooled connection strings** out of the box, which matters on serverless functions.

Supabase's one real advantage is a Cape Town (`af-south-1`) region, which Neon lacks. Discounted deliberately: the latency that matters is app-server↔database, not user↔database — visitors are served CDN-cached HTML. So co-locate the database with the app region rather than the audience. Frankfurt is also the usual lowest-latency European hop from East Africa.

Both free tiers cover this project comfortably, so cost is not the tiebreaker. The decision is reversible — plain Postgres, portable SQL migrations, a `pg_dump` away — so if the client already has a Supabase relationship, switching is cheap.

### 8.5 UI libraries

**shadcn/ui only.** It is a CLI that copies component source into the repo, not a runtime dependency. Built on Radix (accessibility handled: focus traps, keyboard navigation, ARIA) and on the Tailwind 4 already installed. We need roughly six components: dialog, select, accordion (FAQs, itinerary), form primitives, carousel (gallery), tabs. We own the source, so nothing fights the visual design.

**MUI and HeroUI are rejected.** Both impose an opinionated design system we would spend the project overriding, and both add a runtime CSS-in-JS layer that duplicates Tailwind and costs LCP on mobile — directly against the §4.9 performance budget. This site's job is to look like Minara, not like Material.

Install Radix primitives directly only where shadcn doesn't cover a need; below two components, hand-write them.

### 8.6 Shape of the work

Content modelling and CMS config, public page templates, lead form + notification + spam handling, SEO/analytics wiring, content loading. Two developers, roughly two weeks of build — the schedule risk is content (§10), not code.

## 9. Out-of-Scope Reminder (Phase 2 candidates)

Keep a running list here as the client raises features from the original spec, rather than re-litigating scope each time:

- Booking/checkout engine, payments (Stripe + M-Pesa)
- Travel wallet
- Park fee automation, permits
- Hotel search / aggregated inventory
- Mobile app
- Agent/supplier portals
- Reviews, loyalty, referrals
- Live chat widget
- Multi-currency, multi-language
- Granular staff roles and permissions

## 10. Open Questions & Dependencies

**Critical path — content, not code.** Two developers will finish the site well before the client supplies photographs and package copy. Treat the following as dated deliverables with an owner, not as open questions:

| Item | Owner | Needed by |
|---|---|---|
| WhatsApp Business number for deeplinks | Client | Before build starts |
| Staff email address(es) for lead notifications | Client | Before build starts |
| Licence / association membership details + badges (§4.7) | Client | Before launch |
| Office address, phone lines, opening hours | Client | Before launch |
| Copy + images for the 8 launch packages | Client | **2 weeks before launch** |
| Testimonials (names, photos, permission to publish) | Client | Before launch |
| Domain + hosting account ownership (client's, per the earlier agreement that third-party costs are his) | Client | Before launch |

~~Payload/Next 16 compatibility verdict~~ — resolved 2026-08-10, see §8.3.

If launch content has not landed by its date, we ship with placeholder content on a `noindex` staging domain rather than slipping the build.

**Also worth the client's time, and cheaper than most of this site:** claiming and populating the Google Business Profile. For a local travel agency it may well out-perform the website on enquiry volume in the first months.
