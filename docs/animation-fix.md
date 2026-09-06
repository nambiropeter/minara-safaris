# Animation Fixes

Findings from an Emil Kowalski-style animation audit. Ordered by priority — top items are quick/high-impact, bottom items are optional polish.

## Done

- [x] **Home hero moodboard — double-scale on hover** (`src/app/(site)/page.tsx`). Wrapper (`hover:scale-105`) and inner `Image` (`group-hover:scale-105`) both scaled, compounding to ~1.10×. Fix: single scale point — the photo carries the zoom (`group-hover:scale-105` on `Image`), the wrapper carries rotate + shadow + z-index only. Restores the visible "zoom into photo" effect without compounding.
- ~~`hover:hover` media gate on hero tiles~~ — not a bug. Verified in compiled CSS: Tailwind v4's `hover:` variant is already wrapped in `@media (hover: hover)` by default.
- [x] **`Button` `transition-all`** (`src/components/ui/button.tsx`) — scoped to `transition-[background-color,color,box-shadow]`. Only these three actually change across variants; `active:translate-y-px` press feedback kept as-is.
- [x] **Hero moodboard tiles `transition-all`** (`src/app/(site)/page.tsx`) — scoped to `transition-[transform,box-shadow]`.

## Medium priority — destination-accordion (About page)

`src/components/destination-accordion.tsx` is functionally fine and already cites the right easing curve (Emil's iOS drawer curve, `cubic-bezier(0.32,0.72,0,1)`). Three issues, in increasing order of effort:

### 1. Asymmetric enter/exit — done
Both expand and collapse used `duration-500`. Fixed by deriving duration directly from the existing `isHovered` flag — no new state needed, since each card already knows whether it's the one expanding: `isHovered ? "duration-500" : "duration-300"`. The expanding card gets the deliberate 500ms; every other card (collapsing back or yielding space) gets a snappier 300ms.

### 2. Overview text reveal bundles three property types — done
`opacity`, `translate-y`, and `max-h-24` animated under one `transition-all duration-400`. Split into an explicit per-property transition so `max-height` (layout) isn't yoked to the same timing as the compositor-friendly `opacity`/`transform`: `max-height 400ms`, `opacity`/`transform` 300ms each. Worth a slow-motion check in DevTools once real destination copy replaces the seed content — text length affects how the `max-h-24` clamp reads mid-transition.

### 3. `flex`-driven expansion replaced with transform + clip-path — done
Cards previously grew via `md:flex-[2.8]`, reflowing all 4 on every hover frame.

**First attempt (`scaleX`) failed and was reverted.** Worth recording why, because the failure was not a typo: anything inside a `scaleX`'d box has its border-radius and photo stretched, and counter-scaling the content undoes the very width you were trying to produce. `scaleX` cannot drive the width of a rounded, full-bleed photo card. That attempt also rendered as a broken stacked column, and static analysis never explained it — the compiled CSS was correct and `md:absolute` was present in the right media query.

**Shipped approach — fixed width + `translateX` + animated `clip-path`:**
- Each card keeps a **fixed layout width** (the widest it ever gets, ~55%) and never resizes.
- Position comes from `translateX`, visible width from `clip-path: inset(0 X 0 0 round 1rem)`. Both are compositor-friendly, so hover triggers no layout on the cards.
- `round 1rem` keeps corners correctly rounded at *every* clipped width — the specific reason clip-path works here where `scaleX` can't.
- A media wrapper slides the photo by half the clipped amount so a collapsed card shows the photo's middle, not its left sliver.
- The hovered card's visible width equals its layout width, so it is never clipped — which also keeps its focus ring fully visible.
- The text body's width tracks the visible width so titles wrap instead of being cut mid-word, but is **deliberately not transitioned** — animating it would reflow that box every frame, reintroducing exactly the cost this rewrite removes. It re-wraps once on hover change, then holds still.

**Two things were done differently to avoid repeating the first failure:**
1. All layout CSS is hand-written in `globals.css` under `.accordion-track`/`.accordion-card`, not Tailwind `md:` variants — so no utility-ordering or JIT-detection surface.
2. The geometry lives in `src/lib/accordion-layout.ts` (pure, no JSX) with a runnable check: **`pnpm check:accordion`** asserts cards tile the track exactly, never overlap, and end flush at 100%, across every hover state for 1–4 cards.

Note: `sizes` on the card image had to change from `33vw` to ~`56vw` — cards now clip rather than shrink, so a collapsed card still needs the full-width file or it upscales and blurs.

## Removed — no entrance/scroll animations anywhere

Scroll-in and entrance reveals were trialled and then **removed at Leo's request; the site intentionally has none.**
- **Home hero:** clip-path entrance on the moodboard tiles (via a hand-written `@starting-style` rule, since Tailwind v4.3 has no `starting:` variant). Removed — didn't read well, and it fought the LCP budget on above-the-fold `priority` imagery.
- **About "Core Circuits":** `IntersectionObserver` clip-path reveal on the accordion section. Removed along with the observer and the `.reveal-clip` CSS.

Don't reintroduce either without asking. `clip-path` remains in use for the accordion's hover mechanic above — that's an interaction, not an entrance.
