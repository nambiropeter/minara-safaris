import Link from "next/link";

import { nav, site } from "@/lib/site";

/**
 * No licence numbers, association badges, or company registration appear here
 * yet — none are confirmed (PRODUCT.md, Evidence on Hand). The block is left
 * out rather than filled with plausible-looking text; a fabricated registration
 * number is the one placeholder nobody can spot later.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="font-heading text-heading">{site.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Safari and tour packages across Kenya and East Africa. Every trip
              is planned with a consultant — we don&rsquo;t sell anything you
              can&rsquo;t ask a question about first.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-label text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {site.name}
          </p>
          <p className="flex gap-4">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
