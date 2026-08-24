declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

export function trackEvent(name: string, props?: Record<string, string | undefined>) {
  if (typeof window === "undefined" || !window.plausible) return;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value !== undefined) cleaned[key] = value;
  }
  window.plausible(name, Object.keys(cleaned).length > 0 ? { props: cleaned } : undefined);
}
