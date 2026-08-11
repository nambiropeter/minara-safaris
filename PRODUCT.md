# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: Kenyan and East African residents.** Domestic and regional travellers
booking safaris and coastal trips — Maasai Mara, Amboseli, Tsavo, Diani,
Zanzibar. Often deciding on shorter notice, price-sensitive, comparing operators
on WhatsApp, and browsing on a phone over metered mobile data. Resident rates
lead; prices are in KES.

**Secondary: international inbound visitors.** Planning months ahead, higher
budget, needing more reassurance about legitimacy, safety, and logistics before
committing. Every package must therefore carry both the resident and
non-resident rate where they differ, and the trust content has to satisfy
someone who has never heard of the company.

**Staff.** A small team working the Payload admin: publishing packages,
destinations, and articles, and working the leads inbox. No role hierarchy —
all staff have equal access.

## Product Purpose

A lead-generation website. A visitor browses packages and destinations, then
hands off to a human — WhatsApp deeplink or an enquiry form. There is no
checkout, no account, and no booking engine, and that is a deliberate product
decision rather than a phase-one shortcut: the sale closes in conversation.

Success is measured on enquiry volume and quality, not sessions: 15 qualified
enquiries per week and a ≥5% WhatsApp click-through on package detail pages by
launch + 90 days. Organic search is the acquisition channel, which is why the
blog exists as strategy rather than decoration.

## Positioning

**Not established, and must not be invented.** The one differentiator confirmed
today is that the consultant who answers WhatsApp is the person who plans the
trip — no call centre, no ticket queue. A named specialism (a region, or a trip
style such as honeymoon, family, or photography) is wanted but has not been
chosen yet.

**Minara is currently an intermediary.** It does not own vehicles and does not
employ its guides. No copy, imagery, or claim may imply an owned fleet, in-house
guiding team, or direct operation of the safaris it sells.

## Operating Context

Enquiries arrive and are worked on WhatsApp; the website's job ends at the
handoff. Staff follow up manually — there is no pipeline, assignment, or
automation, and no customer-facing ticket tracking. Combination itineraries
across countries (Kenya + Tanzania) are a real product, not an edge case.

## Capabilities and Constraints

- Browse packages and destinations; filter by destination, duration, price, and
  trip style; read a day-by-day itinerary with inclusions and exclusions.
- Convert by WhatsApp deeplink (prefilled with package name and URL) or an
  enquiry form. Outbound WhatsApp clicks must be tracked as a conversion event
  with the package slug — untracked, there is no way to know the site works.
- Prices are never rendered bare. `price_from` always ships with its
  `price_note` ("per person sharing, low season") and the resident rate where it
  differs. A bare number generates bad-fit enquiries and burns agent time.
- Mobile-first on metered data: LCP under 2.5s on 4G, every image through
  `next/image`.
- The enquiry endpoint is a public unauthenticated POST — honeypot, per-IP rate
  limit, and a time-to-submit check are requirements.
- One currency (KES) with a free-text note. Multi-currency and multi-language
  are out of scope.
- **Open:** the WhatsApp Business number, staff notification inbox, office
  address, and opening hours are all still pending from the client.

## Brand Commitments

The name is Minara Safaris. A logo exists in some form but has not been
confirmed as final — treat it as provisional and do not build an identity that
breaks if it changes.

No voice guide or tagline has been established.

**Visual direction is a standing commitment, chosen deliberately on 2026-08-11:
the category convention, executed at a craft level the category does not reach.**
Offered a dealt alternative (a lithographic East African Railways poster-and-fare-table
world) and two further alternates, the owner took the category standard on purpose.
Convention is therefore the commitment — no irony, no smuggled quirk, no partial
subversion. Warm ground, large photography, restrained type, one accent, destination
tiles. The tokens already in `src/app/globals.css` are that world and stand confirmed.

The craft bar is set by three references, in order of how they apply:

- **Modern adventure-travel brands** (Much Better Adventures, Intrepid, Flash Pack) —
  the primary bar. Conversion-forward and price-transparent: itineraries laid out
  plainly, inclusions stated up front, a visible human to talk to.
- **Editorial travel publishing** (Condé Nast Traveller, Suitcase, Fathom) — the bar
  for typography, image handling, and the article template the SEO strategy depends on.
- **Kenyan market peers** (Bonfire, Perfect Wilderness, Gamewatchers) — the floor to
  beat and evidence of local expectations, not a craft reference.

## Evidence on Hand

**Almost nothing is confirmed, and the absences are the point.** Development
proceeds on stock imagery and placeholder copy so the design and admin can be
finished; real content replaces it before launch.

Explicitly absent, and never to be fabricated:

- Licence numbers, KATO / TRA or equivalent association membership, company
  registration.
- Testimonials — no named traveller, photograph, quote, or rating may be
  invented, including as placeholder.
- Own photography of Minara's trips, guides, or vehicles.
- Years operating, traveller counts, or any other trust-bar statistic.

Placeholder imagery must be visibly placeholder to staff and unmistakably
replaceable; placeholder *claims* must not exist at all. See `docs/PRD.md` §4.7
and §10, and the blocked list in `docs/WORK-PLAN.md`.

## Product Principles

1. **The handoff is the product.** Every surface is measured by whether it
   produces a good conversation, not by time on site. Anything resembling
   self-serve checkout is out of scope.
2. **Claim only what is true.** In a market where travel scams are common, an
   unverifiable badge is worse than no badge. Absent proof is designed around,
   not filled in.
3. **Two audiences, one page.** Resident-first copy and pricing that still
   satisfies a stranger from overseas — not two sites, and not a compromise that
   serves neither.
4. **The phone on mobile data is the real device.** Performance is a product
   requirement, not an optimisation pass.
5. **Scope discipline.** The PRD was cut once from a three-service design.
   Deleting beats adding.

## Accessibility & Inclusion

Contrast ≥4.5:1, semantic landmarks, visible focus states, labelled form fields
with real error messages, and required alt text on every content image
(`media.alt` is a required CMS field, not optional). Touch targets ≥44px —
much of the audience is one-handed on a phone.
