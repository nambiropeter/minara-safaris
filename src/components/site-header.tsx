"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CurrencySwitcher } from "@/components/currency-switcher";
import { PaletteToggle } from "@/components/palette-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { nav, site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const activeHeader = isScrolled || open;
  const desktopNav = nav.filter((item) => item.href !== "/contact");

  return (
    <>
      <div ref={sentinelRef} className="absolute top-0 inset-x-0 h-px pointer-events-none" aria-hidden="true" />
      <header
        className={cn(
          "sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-350 ease-out",
          activeHeader
            ? "border-b border-border bg-background/85 backdrop-blur-md backdrop-saturate-150 shadow-[0_1px_24px_rgba(0,0,0,0.05)]"
            : "border-b border-transparent bg-transparent shadow-none",
        )}
      >
      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:h-20 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 sm:gap-3.5 group shrink-0"
          onClick={() => setOpen(false)}
        >
          <div className="relative h-10 w-[60px] sm:h-11 sm:w-[66px] shrink-0">
            <Image
              src="/images/minara-logo-mark.png"
              alt=""
              fill
              sizes="80px"
              priority
              className="object-contain dark:hidden"
            />
            <Image
              src="/images/minara-logo-mark-dark.png"
              alt=""
              fill
              sizes="80px"
              priority
              className="object-contain hidden dark:block"
            />
          </div>
          <span className="font-heading text-heading tracking-tight group-hover:text-primary transition-colors">
            {site.name}
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden lg:flex items-center lg:absolute lg:left-1/2 lg:-translate-x-1/2"
        >
          <ul className="flex items-center gap-6 xl:gap-8">
            {desktopNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "link-underline inline-flex items-center py-1 text-sm font-medium tracking-wide transition-colors",
                      active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <CurrencySwitcher size="sm" className="hidden sm:inline-flex" />
          <PaletteToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          <WhatsAppCta
            size="default"
            label="WhatsApp"
            className="hidden lg:inline-flex h-8.5 rounded-full px-3.5 text-xs font-semibold shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-transform"
          />
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full border border-border/80 text-foreground transition-colors hover:border-primary hover:bg-muted/50 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="grid w-[18px] gap-[5px]" aria-hidden="true">
              <span
                className={cn(
                  "block h-[2px] w-full rounded-[1px] bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  open && "translate-y-[3.5px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-[2px] w-full rounded-[1px] bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  open && "-translate-y-[3.5px] -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-border bg-background shadow-lg max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain lg:hidden"
        >
          <ul className="mx-auto w-full max-w-6xl px-5 py-2 sm:px-8">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href} className="border-b border-border last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center text-base py-3 transition-colors",
                      active
                        ? "border-l-2 border-primary pl-3 font-semibold text-primary"
                        : "text-muted-foreground hover:text-foreground px-1",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-t border-border px-5 py-3 sm:hidden">
            <CurrencySwitcher />
            <PaletteToggle />
          </div>
        </nav>
      )}
    </header>
    </>
  );
}
