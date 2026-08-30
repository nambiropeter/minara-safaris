import Image from "next/image";
import Link from "next/link";

import { RouteMap } from "@/components/route-map";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { nav, site } from "@/lib/site";

/**
 * No licence numbers, association badges, or company registration appear here
 * yet — none are confirmed (PRODUCT.md, Evidence on Hand). The block is left
 * out rather than filled with plausible-looking text; a fabricated registration
 * number is the one placeholder nobody can spot later.
 */
export function SiteFooter() {
  return (
    <footer className="bg-secondary/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        {/* Wraps rather than squeezing: three columns only fit side by side
            once there's room for the map. */}
        <div className="flex flex-col gap-10 sm:flex-row sm:flex-wrap sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3.5">
              <div className="relative h-12 w-[72px] sm:h-14 sm:w-[84px] shrink-0">
                <Image
                  src="/images/minara-logo-mark.png"
                  alt=""
                  fill
                  sizes="90px"
                  className="object-contain dark:hidden"
                />
                <Image
                  src="/images/minara-logo-mark-dark.png"
                  alt=""
                  fill
                  sizes="90px"
                  className="object-contain hidden dark:block"
                />
              </div>
              <div>
                <p className="font-heading text-title leading-tight">{site.name}</p>
                <p className="text-xs text-muted-foreground italic">{site.tagline}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Safari and tour packages across Kenya and East Africa. Every trip
              is planned with a consultant - we don&rsquo;t sell anything you
              can&rsquo;t ask a question about first.
            </p>
            <WhatsAppCta label="Chat with a consultant" className="mt-6" />
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:grid-cols-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="link-underline text-sm text-muted-foreground hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <RouteMap />
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-label text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {site.name}
          </p>
          <p className="flex gap-4">
            <Link href="/terms" className="link-underline hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="link-underline hover:text-foreground">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
