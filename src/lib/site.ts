/**
 * Facts about the business that the CMS does not own.
 *
 * Anything here that is still unconfirmed is marked and must not be invented —
 * see PRODUCT.md, Evidence on Hand. A placeholder phone number printed as if it
 * were real is a worse failure than an obviously missing one.
 */

export const site = {
  name: "Minara Safaris",
  tagline: "Kenyan safaris and East African tours",
  /** Unconfirmed. Set NEXT_PUBLIC_WHATSAPP_NUMBER (digits only, country code, no +). */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
} as const;

export const nav = [
  { href: "/packages", label: "Packages" },
  { href: "/destinations", label: "Destinations" },
  { href: "/journal", label: "Journal" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * Builds the wa.me deeplink. Returns null when no number is configured, so
 * callers render nothing rather than a dead link — the client has not supplied
 * the WhatsApp Business number yet.
 */
export function whatsappHref(message: string): string | null {
  if (!site.whatsappNumber) return null;
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
