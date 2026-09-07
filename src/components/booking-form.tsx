"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

const inputClass =
  "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

type Props = {
  packageId: number;
  packageSlug: string;
};

/**
 * Redirects to Stripe Checkout on success — the server (not this form) owns
 * the price. `quantity` is derived from adults+children rather than asked
 * for separately, since a child currently costs the same as an adult (no
 * child-rate field exists on Packages yet).
 */
export function BookingForm({ packageId, packageSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = new FormData(event.currentTarget);
    const adults = Number(form.get("adults")) || 1;
    const children = Number(form.get("children")) || 0;

    const body = {
      items: [{ kind: "package", refId: String(packageId), quantity: adults + children }],
      customerName: form.get("name"),
      customerEmail: form.get("email"),
      customerPhone: form.get("phone") || undefined,
      travelDate: form.get("travelDate") || undefined,
      adults,
      children,
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      trackEvent("checkout_started", { package: packageSlug });
      window.location.href = data.url;
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <Button type="button" size="cta" className="w-full" onClick={() => setOpen(true)}>
        Book now
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Name
        <input name="name" type="text" required maxLength={200} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Email
        <input name="email" type="email" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Phone (optional)
        <input name="phone" type="tel" maxLength={50} className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-label text-muted-foreground">
          Adults
          <input name="adults" type="number" min={1} max={50} defaultValue={1} required className={inputClass} />
        </label>

        <label className="flex flex-col gap-1 text-label text-muted-foreground">
          Children
          <input name="children" type="number" min={0} max={50} defaultValue={0} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Travel date (optional)
        <input name="travelDate" type="text" placeholder="e.g. 12 October 2026" maxLength={40} className={inputClass} />
      </label>

      {status === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button type="submit" size="cta" className="w-full" disabled={status === "submitting"}>
        {status === "submitting" ? "Redirecting…" : "Continue to payment"}
      </Button>
    </form>
  );
}
