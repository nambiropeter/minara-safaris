"use client";

import { SunHorizon, Waves } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PALETTE_STORAGE_KEY } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Flips between the Sunset (default) and Ocean palettes. See `@/lib/palette`. */
export function PaletteToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.palette === "ocean" ? "sunset" : "ocean";
    if (next === "ocean") root.dataset.palette = "ocean";
    else delete root.dataset.palette;
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Private mode: applies for this page only.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-8.5 rounded-full border border-border/70 text-muted-foreground hover:text-foreground transition-colors hover:border-primary hover:bg-muted/50",
        className,
      )}
      aria-label="Switch between ocean and sunset colours"
      onClick={toggle}
      data-analytics-event="palette_switch"
    >
      {/* Both icons render and CSS picks one off the <html> attribute, so the
          control is right before hydration, same trick as ThemeToggle. */}
      <Waves className="size-4 [[data-palette=ocean]_&]:hidden" />
      <SunHorizon className="hidden size-4 [[data-palette=ocean]_&]:block" />
    </Button>
  );
}
