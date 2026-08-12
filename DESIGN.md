# Design

Recorded from the built home page and shell, 2026-08-11. Product truth lives in
`PRODUCT.md`; this file records visual decisions only.

## Direction

**The category convention, executed at a craft level the category does not reach.**
Chosen deliberately over a dealt alternative — convention is the commitment, so
there is no irony and no partial subversion. Craft bar: Much Better Adventures /
Intrepid for structure and price transparency, Condé Nast Traveller / Suitcase
for typography and image handling.

The one thing the surface owns: **the price is never a hook.** Every figure ships
with its conditions and the resident rate beside it, enforced by `PriceBlock`
being the only component that renders money.

## Color

Warm savanna, four roles. Both themes are designed and contrast-verified — dark
is a warm near-black built for photography, not an inversion.

| Token | Role |
|---|---|
| `--primary` | Sienna. Buttons, links, focus ring, step rules |
| `--gold` | Offer and deal badges **only** |
| `--whatsapp` | The WhatsApp CTA **only** — nothing else on the site is green |
| `--accent` | Hover and quiet surfaces. Never gold |
| `--background` | Warm paper, so photographs sit better than on pure white |

On dark, foreground on `primary` / `gold` / `whatsapp` is **ink, not white** —
white on lifted sienna is 3.3:1 and fails. Verified: fg/bg 16.8, muted/bg 8.3,
primary/bg 5.8, ink/primary 5.8, ink/gold 10.8, ink/whatsapp 8.2.

Never write a raw hex or a Tailwind palette class in a component.

## Type

Newsreader (`font-heading`) for headings, package titles, and the price figure;
Figtree (`font-sans`) for UI and body. Both variable, latin-only, self-hosted.
Newsreader does double duty as the blog's reading face, so the blog costs no
extra font.

Roles are tokens, never ad-hoc sizes: `text-display`, `text-title`,
`text-heading`, `text-lead`, `text-label`. Display and title are fluid; the rest
are fixed so product surfaces stay spatially predictable. Prose is capped by the
`measure` utility at 68ch. Prices and step numbers use `tabular-nums`.

## Composition

- Container is `max-w-6xl` with `px-5 sm:px-8`. Sections separate by generous
  vertical space and 1px rules; alternating bands use `bg-secondary/40`.
- **Photography is the material.** Package cards are 4:5, destination tiles 3:4.
- **The hero is a scattered stack**, not a single frame: five photographs
  overlapping inside a fixed-height column, each rotated a few degrees
  (−6° to +6°), each carrying a place-name pill bottom-left on a
  `bg-black/50 backdrop-blur` chip, with the portrait Mara frame centred on top
  at `z-20`. Hovering one lifts it above the pile and rotates it toward upright.
  The stack sits right of the headline on desktop and drops beneath it on
  phones. This is the one place the site uses rotation, layered z-index and
  drop shadows; everywhere else is flat and squared.
- Images scale 1.03–1.05 on hover, 500ms ease-out; nothing else moves.
- Cards are image-first with the text block beneath. No nested cards. No kicker
  or eyebrow labels above headings — the heading carries its own weight.
- The "How booking actually goes" steps are numbered because the sequence is the
  information; they are rules-over-content, not icon-heading-text cards.

## Components

`PriceBlock` (the only money renderer) · `PackageCard` (used by home, catalogue,
destination pages, related rails) · `WhatsAppCta` (renders nothing when no number
is configured, and carries `data-analytics-*` for the Phase 5 conversion event) ·
`SiteHeader` / `SiteFooter` / `MobileCtaBar` · `ThemeToggle`.

Buttons come from shadcn with two project additions: a `whatsapp` variant and a
`cta` size, because the shipped scale tops out at 36px and touch targets are
≥44px.

## Rules that are easy to break

1. Green means WhatsApp. Nothing else may be green.
2. Gold means an offer. Never a hover state.
3. A price without its note is a bug, not a style choice.
4. Empty is a designed state, not a failure: no featured packages, no offers, and
   no trust content are all normal, and the page holds together in each.
5. Nothing may claim a licence, badge, statistic, or testimonial. See PRODUCT.md.
