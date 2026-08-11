"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { List, X } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { Button } from "@/components/ui/button";
import { nav, site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:h-20 sm:px-8">
        <Link
          href="/"
          className="font-heading text-heading tracking-tight"
          onClick={() => setOpen(false)}
        >
          {site.name}
        </Link>

        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-7">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "text-sm transition-colors hover:text-foreground",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-4">
          <ThemeToggle />
          <WhatsAppCta size="default" label="WhatsApp" className="hidden lg:inline-flex" />
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-11 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <List className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-border bg-background lg:hidden"
        >
          <ul className="mx-auto w-full max-w-6xl px-5 py-2 sm:px-8">
            {nav.map((item) => (
              <li key={item.href} className="border-b border-border last:border-b-0">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center text-base"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
