"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Package } from "@/payload-types";

type Props = {
  packages: Pick<Package, "id" | "title">[];
};

const inputClass =
  "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

/**
 * Attribution (source/referrer/utm) is captured client-side at mount, since
 * the page itself is ISR-cached and can't embed a per-visit timestamp or
 * query string server-side (PRD §4.5).
 */
export function EnquiryForm({ packages }: Props) {
  const [startedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);

    const body = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone") || undefined,
      package: form.get("package") || undefined,
      travelDates: form.get("travelDates") || undefined,
      travellers: form.get("travellers") || undefined,
      message: form.get("message") || undefined,
      startedAt,
      website: form.get("website") || undefined,
      source: window.location.pathname,
      referrer: document.referrer || undefined,
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <p className="font-heading text-heading">Thanks — that&apos;s with us now</p>
        <p className="measure mx-auto mt-2 text-muted-foreground">
          A consultant will reply by email. If it&apos;s urgent, message us on WhatsApp instead.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
        aria-hidden="true"
      />

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

      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Travellers
        <input name="travellers" type="number" min={1} max={50} defaultValue={1} className={inputClass} />
      </label>

      {packages.length > 0 && (
        <label className="flex flex-col gap-1 text-label text-muted-foreground">
          Package (optional)
          <select name="package" defaultValue="" className={inputClass}>
            <option value="">Not sure yet</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-label text-muted-foreground">
        Preferred dates (optional)
        <input name="travelDates" type="text" placeholder="e.g. mid-October, 7 days" maxLength={200} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-label text-muted-foreground sm:col-span-2">
        Message
        <textarea name="message" rows={4} maxLength={4000} className={`${inputClass} h-auto py-2.5`} />
      </label>

      {status === "error" && <p className="text-sm text-destructive sm:col-span-2">{errorMessage}</p>}

      <div className="sm:col-span-2">
        <Button type="submit" size="cta" disabled={status === "submitting"}>
          {status === "submitting" ? "Sending…" : "Send enquiry"}
        </Button>
      </div>
    </form>
  );
}
