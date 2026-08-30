"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { cardGeometry, cardVars, maxVisible, trackVars } from "@/lib/accordion-layout";
import type { Destination, Media } from "@/payload-types";

function asMedia(value: number | Media | null | undefined): Media | null {
  return value && typeof value === "object" ? value : null;
}

function extractPlainText(richText: any): string {
  if (!richText || !richText.root || !richText.root.children) return "";
  const extract = (node: any): string => {
    if (node.text) return node.text;
    if (node.children) return node.children.map(extract).join(" ");
    return "";
  };
  return richText.root.children.map(extract).join(" ").trim();
}

/**
 * Interactive expanding 4-destination cards.
 * Uses Emil Kowalski's iOS-like drawer easing curve: cubic-bezier(0.32, 0.72, 0, 1).
 *
 * Cards hold a fixed layout width and animate only `transform` (position) and
 * `clip-path` (visible width), so hovering never reflows the row. See
 * src/lib/accordion-layout.ts for the geometry and why scaleX was rejected;
 * the desktop CSS lives in globals.css under `.accordion-track`.
 */
export function DestinationAccordion({
  destinations,
}: {
  destinations: Destination[];
}) {
  const cards = destinations.slice(0, 4);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  // Card widths change the moment hover changes, which re-wraps the text.
  // Hide it for that one frame so the reflow is never seen, then let CSS fade
  // it back in. Skipped on mount — the page itself has no entrance animation.
  const [rewrapping, setRewrapping] = React.useState(false);
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setRewrapping(true);
    // Two frames: one for the new width to apply, one to start the fade back.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setRewrapping(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [hoveredIndex]);

  const max = maxVisible(cards.length);
  const geometry = cardGeometry(cards.length, hoveredIndex);

  return (
    <div
      style={trackVars(cards.length) as React.CSSProperties}
      className="accordion-track"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {cards.map((destination, index) => {
        const cover = asMedia(destination.coverImage);
        const overviewText = extractPlainText(destination.overview);
        const isHovered = hoveredIndex === index;

        // Asymmetric timing: expanding is the user deciding (deliberate),
        // collapsing/yielding is the system responding (should feel snappier).
        const style = {
          ...cardVars(geometry[index], max),
          "--card-duration": isHovered ? "500ms" : "300ms",
        } as React.CSSProperties;

        return (
          <Link
            key={destination.id}
            href={`/destinations/${destination.slug}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
            style={style}
            className="accordion-card group flex min-h-[320px] flex-col justify-end overflow-hidden rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none md:min-h-0"
          >
            {/* Background image. The wrapper slides the photo so a collapsed
                card shows its middle rather than its left edge.
                `sizes` assumes the fixed ~55% card width — cards clip rather
                than shrink, so a 33vw hint would upscale a too-small file. */}
            {cover?.url ? (
              <div className="accordion-card-media absolute inset-0">
                <Image
                  src={cover.url}
                  alt={cover.alt || destination.name}
                  fill
                  sizes="(min-width: 1200px) 640px, (min-width: 768px) 56vw, 92vw"
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
                {destination.name}
              </div>
            )}

            {/* Gradient Scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent transition-opacity duration-300 group-hover:from-black/90 group-hover:via-black/45" />

            {/* Content Area */}
            <div
              data-rewrapping={rewrapping}
              className="accordion-card-body relative z-10 flex flex-col p-5 sm:p-6 text-white"
            >
              <h3 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
                {destination.name}
              </h3>

              {/* Overview summary from CMS - smoothly reveals on expand / hover */}
              {overviewText && (
                <p
                  className={`mt-2 text-sm leading-relaxed text-white/85 line-clamp-3 md:overflow-hidden [transition:max-height_400ms_ease-out,opacity_300ms_ease-out,transform_300ms_ease-out] ${
                    isHovered
                      ? "opacity-100 translate-y-0 max-h-24"
                      : "md:max-h-0 md:opacity-0 md:translate-y-2"
                  }`}
                >
                  {overviewText}
                </p>
              )}

              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-white/90 group-hover:text-white">
                <span>Explore destination</span>
                <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
