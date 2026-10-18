"use client";

import { useTheme } from "next-themes";

import { Moon, Sun } from "@/components/icons";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-8.5 rounded-full border border-border/70 text-muted-foreground hover:text-foreground transition-colors hover:border-primary hover:bg-muted/50",
        className,
      )}
      aria-label="Switch between light and dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons render; CSS picks one, so the control is correct on the
          server too and never flashes the wrong state after hydration. */}
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
