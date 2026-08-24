"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics";

/**
 * One delegated click listener instead of a client boundary on every CTA —
 * `WhatsAppCta` (and anything else) just needs `data-analytics-event`/
 * `data-analytics-*` attributes and stays a server component.
 */
export function AnalyticsListener() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-analytics-event]");
      if (!target) return;

      const { analyticsEvent, ...rest } = target.dataset;
      if (!analyticsEvent) return;

      const props: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (key.startsWith("analytics") && key !== "analyticsEvent") {
          props[key.replace(/^analytics/, "").replace(/^./, (c) => c.toLowerCase())] = value;
        }
      }
      trackEvent(analyticsEvent, props);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
