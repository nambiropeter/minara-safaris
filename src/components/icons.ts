/**
 * The site's icon set. Add icons here rather than importing Phosphor ad hoc.
 *
 * Two reasons this file exists instead of a bare `@phosphor-icons/react` import:
 *
 * 1. Phosphor's root export is the client build and reads `IconContext`, which
 *    makes it unusable from a server component. `dist/ssr/*` is the SSR build —
 *    plain forwardRef components, no context. Everything here is that build, so
 *    icons render on the server and never pull a page into the client bundle.
 * 2. Per-icon paths, not the barrel. Phosphor ships ~1500 icons × 6 weights and
 *    is not in Next's `optimizePackageImports` defaults, so a barrel import
 *    leans entirely on tree-shaking; deep paths do not.
 *
 * Because these are the SSR build, `IconContext.Provider` has no effect —
 * `size` and `weight` are per-usage props. Site convention: `weight="regular"`
 * (the default) for the 16–20px metadata glyphs, `weight="fill"` for brand
 * marks and anything above 32px.
 *
 * Each module exports both `MapPin` and `MapPinIcon`; the unsuffixed alias is
 * deprecated upstream, so re-export the `*Icon` symbol and drop the suffix here.
 */
export { ArrowRightIcon as ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
export { CalendarBlankIcon as CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
export { ListIcon as List } from "@phosphor-icons/react/dist/ssr/List";
export { MapPinIcon as MapPin } from "@phosphor-icons/react/dist/ssr/MapPin";
export { MoonIcon as Moon } from "@phosphor-icons/react/dist/ssr/Moon";
export { SunIcon as Sun } from "@phosphor-icons/react/dist/ssr/Sun";
export { UsersIcon as Users } from "@phosphor-icons/react/dist/ssr/Users";
export { WhatsappLogoIcon as WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
export { XIcon as X } from "@phosphor-icons/react/dist/ssr/X";
