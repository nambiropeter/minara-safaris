"use client";

import { useTheme } from "next-themes";

import { Moon, Sun } from "@/components/icons";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="size-11 rounded-full border border-border/80 transition-colors hover:border-primary hover:bg-muted/50"
      aria-label="Switch between light and dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons render; CSS picks one, so the control is correct on the
          server too and never flashes the wrong state after hydration. */}
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </Button>
  );
}
