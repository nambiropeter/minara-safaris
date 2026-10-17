"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";
import { hotelPost, type BookResponse } from "@/lib/hotel-client";
import { formatHotelMoney } from "@/lib/hotel-format";

const inputClass = "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";
const labelClass = "flex flex-col gap-1 text-label text-muted-foreground";

type Props = {
  /** The key CheckRate just confirmed. The server re-checks it anyway and uses its own. */
  rateKey: string;
  /** The price the visitor has been shown and agreed to, in minor units of `currency`. */
  from: number;
  currency: "KES" | "USD";
  adults: number;
  childAges: number[];
  hotelName: string;
  /** Set when booking with a package: its id and the subtotal the visitor was shown. */
  bundle?: { id: string; subtotal: number };
};

/**
 * Names for everyone staying (Hotelbeds requires them), contact details, then Stripe.
 *
 * The browser sends the price it showed, never a price to charge: the server re-checks
 * the rate and refuses to proceed if its figure differs. When that happens the visitor
 * sees both numbers and must accept the new one before anything is submitted again.
 */
export function HotelBookingForm({ rateKey, from, currency, adults, childAges, hotelName, bundle }: Props) {
  const [agreed, setAgreed] = useState(from);
  const [changedTo, setChangedTo] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const guests = [
    ...Array.from({ length: adults }, (_, i) => ({ label: i === 0 ? "Adult 1 (lead guest)" : `Adult ${i + 1}` })),
    ...childAges.map((age, i) => ({ label: `Child ${i + 1}, age ${age}` })),
  ];

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const result = await hotelPost<BookResponse>("/api/hotels/book", {
      rateKey,
      shownFrom: agreed,
      adults,
      childAges,
      currency,
      guests: guests.map((_, i) => ({ firstName: form.get(`first-${i}`), lastName: form.get(`last-${i}`) })),
      customerEmail: form.get("email"),
      customerPhone: form.get("phone") || undefined,
      ...(bundle && { package: { id: bundle.id, shownSubtotal: bundle.subtotal } }),
    });

    if (result.ok && result.data.url) {
      trackEvent("hotel_checkout_started", { hotel: hotelName });
      window.location.href = result.data.url;
      return;
    }

    if (!result.ok && result.status === 409 && result.body.priceChanged === true && typeof result.body.from === "number") {
      setChangedTo(result.body.from);
      setStatus("idle");
      return;
    }

    setErrorMessage(result.ok ? "Something went wrong. Please try again." : result.error);
    setStatus("error");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5 border-t border-border pt-6">
      <h4 className="text-heading">Who is staying?</h4>

      {guests.map((guest, i) => (
        <fieldset key={guest.label} className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-label text-muted-foreground">{guest.label}</legend>
          <label className={labelClass}>
            First name
            <input name={`first-${i}`} type="text" required maxLength={50} autoComplete={i === 0 ? "given-name" : "off"} className={inputClass} />
          </label>
          <label className={labelClass}>
            Last name
            <input name={`last-${i}`} type="text" required maxLength={50} autoComplete={i === 0 ? "family-name" : "off"} className={inputClass} />
          </label>
        </fieldset>
      ))}
      <p className="-mt-2 text-label text-muted-foreground">Names as they appear on each guest&apos;s ID, as the hotel will ask for it at check-in.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className={labelClass}>
          Phone (optional)
          <input name="phone" type="tel" maxLength={50} autoComplete="tel" className={inputClass} />
        </label>
      </div>

      {changedTo !== null && (
        <div role="alert" className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="font-medium">The price has changed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It was {formatHotelMoney(agreed, currency)} and is now{" "}
            <strong className="text-foreground">{formatHotelMoney(changedTo, currency)}</strong>. Nothing has been charged.
          </p>
          <Button
            type="button"
            size="cta"
            className="mt-3"
            onClick={() => {
              setAgreed(changedTo);
              setChangedTo(null);
            }}
          >
            Accept the new price
          </Button>
        </div>
      )}

      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="cta" className="w-full sm:w-fit" disabled={status === "submitting" || changedTo !== null}>
        {status === "submitting" ? "Redirecting…" : `Pay ${formatHotelMoney(agreed + (bundle?.subtotal ?? 0), currency)} securely`}
      </Button>
      <p className="-mt-2 text-label text-muted-foreground">You will pay with Stripe. Nothing is charged until you confirm there.</p>
    </form>
  );
}
