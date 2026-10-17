"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useCurrencyPreference } from "@/components/currency-provider";
import { HotelBookingForm } from "@/components/hotel-booking-form";
import { HotelPrice } from "@/components/hotel-price";
import { Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { trackEvent } from "@/lib/analytics";
import {
  hotelPost,
  parseStay,
  type CheckrateResponse,
  type HotelApiResult,
  type RatesResponse,
} from "@/lib/hotel-client";
import { cancellationLines, formatHotelDate, formatHotelMoney, nightsLabel } from "@/lib/hotel-format";

type Rate = RatesResponse["rooms"][number]["rates"][number];
type Chosen = { room: string; rate: Rate };

/**
 * Rooms and rates for one hotel, and the step Hotelbeds' contract insists on: the
 * price is re-checked with the supplier before anyone is asked to pay. If it moved,
 * the visitor sees both figures and has to accept the new one; nothing proceeds on
 * a price they did not see.
 */
export function HotelRates({ hotelCode, hotelName }: { hotelCode: number; hotelName: string }) {
  const params = useSearchParams();
  const stay = useMemo(() => parseStay(params), [params]);
  const currency = useCurrencyPreference() ?? "KES";
  const packageId = params.get("package");

  const key = `${hotelCode}|${params.toString()}|${currency}`;
  const [answer, setAnswer] = useState<{ key: string; result: HotelApiResult<RatesResponse> } | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [checking, setChecking] = useState(false);
  const [changed, setChanged] = useState<CheckrateResponse | null>(null);
  const [confirmed, setConfirmed] = useState<CheckrateResponse | null>(null);
  const [problem, setProblem] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!stay) return;
    let stale = false;
    void hotelPost<RatesResponse>("/api/hotels/rates", { hotelCode, ...stay, currency }).then((result) => {
      if (!stale) setAnswer({ key, result });
    });
    return () => {
      stale = true;
    };
  }, [key, stay, hotelCode, currency]);

  function reset() {
    setChosen(null);
    setChanged(null);
    setConfirmed(null);
    setPaying(false);
    setProblem("");
  }

  async function select(room: string, rate: Rate) {
    reset();
    setChosen({ room, rate });
    setChecking(true);
    const result = await hotelPost<CheckrateResponse>("/api/hotels/checkrate", {
      rateKey: rate.rateKey,
      shownFrom: rate.from,
      currency,
      ...(packageId && { packageId }),
    });
    setChecking(false);

    if (!result.ok) {
      setChosen(null);
      setProblem(
        result.status === 409
          ? "That rate is no longer available. Please choose another."
          : result.error,
      );
      return;
    }
    if (result.data.priceChanged) {
      setChanged(result.data);
      return;
    }
    accept(result.data);
  }

  function accept(rate: CheckrateResponse) {
    setChanged(null);
    setConfirmed(rate);
    trackEvent("hotel_rate_confirmed", { hotel: hotelName });
  }

  if (!stay) {
    return (
      <p className="text-muted-foreground">
        Pick your dates to see rooms and prices.{" "}
        <Link href="/hotels" className="text-primary underline underline-offset-4">
          Search hotels
        </Link>
      </p>
    );
  }

  const result = answer?.key === key ? answer.result : null;
  if (!result) {
    return (
      <p role="status" className="text-muted-foreground">
        Loading rooms and prices…
      </p>
    );
  }
  if (!result.ok) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4">
        <p className={result.status === 404 ? "text-muted-foreground" : "text-destructive"}>
          {result.status === 404 ? "This hotel has no rooms available for these dates." : result.error}
        </p>
        <WhatsAppCta context={hotelName} />
      </div>
    );
  }

  const { rooms, nights } = result.data;
  const guests = `${stay.adults} ${stay.adults === 1 ? "adult" : "adults"}${
    stay.childAges.length > 0 ? `, ${stay.childAges.length} ${stay.childAges.length === 1 ? "child" : "children"}` : ""
  }`;

  if (confirmed && chosen) {
    return (
      <div className="rounded-xl border border-border p-6">
        <p className="flex items-center gap-2 text-label font-medium text-primary">
          <Check className="size-4" /> Rate confirmed with the hotel
        </p>
        <h3 className="mt-2 text-heading">{chosen.room}</h3>
        <p className="text-muted-foreground">
          {confirmed.board.name.toLowerCase()} · {formatHotelDate(stay.checkIn)} to {formatHotelDate(stay.checkOut)} · {guests}
        </p>
        <HotelPrice amount={confirmed.from} currency={currency} nights={nights} size="detail" className="mt-4" />
        {confirmed.package && (
          <dl className="mt-4 grid gap-2 rounded-lg border border-border p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt>
                {confirmed.package.title}, {confirmed.package.quantity} {confirmed.package.quantity === 1 ? "traveller" : "travellers"}
                <span className="block text-label text-muted-foreground">{confirmed.package.priceNote}</span>
              </dt>
              <dd>{formatHotelMoney(confirmed.package.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>This hotel</dt>
              <dd>{formatHotelMoney(confirmed.from, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt>Total</dt>
              <dd>{formatHotelMoney(confirmed.from + confirmed.package.subtotal, currency)}</dd>
            </div>
          </dl>
        )}
        <ul className="mt-3 text-sm text-muted-foreground">
          {cancellationLines(confirmed.cancellation, currency, confirmed.from).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {confirmed.comments && (
          <div className="mt-4">
            <p className="text-label font-medium">Good to know</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{confirmed.comments}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!paying && (
            <Button type="button" size="cta" onClick={() => setPaying(true)}>
              Continue to payment
            </Button>
          )}
          <WhatsAppCta
            label="Book with a consultant"
            context={`${hotelName}, ${chosen.room} (${confirmed.board.name.toLowerCase()}), ${stay.checkIn} to ${stay.checkOut}, ${guests}`}
          />
          <Button type="button" variant="outline" size="cta" onClick={reset}>
            Choose a different room
          </Button>
        </div>

        {paying && (
          <HotelBookingForm
            rateKey={confirmed.rateKey}
            from={confirmed.from}
            currency={currency}
            adults={stay.adults}
            childAges={stay.childAges}
            hotelName={hotelName}
            bundle={confirmed.package && packageId ? { id: packageId, subtotal: confirmed.package.subtotal } : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}

      {changed && chosen && (
        <div role="alert" className="rounded-xl border border-border bg-secondary/40 p-6">
          <h3 className="text-heading">The price has changed</h3>
          <p className="mt-2 text-muted-foreground">
            It was {formatHotelMoney(changed.previousFrom, currency)} and is now{" "}
            <strong className="text-foreground">{formatHotelMoney(changed.from, currency)}</strong> for {nightsLabel(nights)}
            , {chosen.room.toLowerCase()}, {changed.board.name.toLowerCase()}.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="cta" onClick={() => accept(changed)}>
              Accept the new price
            </Button>
            <Button type="button" variant="outline" size="cta" onClick={reset}>
              Choose something else
            </Button>
          </div>
        </div>
      )}

      {rooms.map((room) => (
        <section key={room.code} aria-labelledby={`room-${room.code}`}>
          <h3 id={`room-${room.code}`} className="text-heading">
            {room.name}
          </h3>
          <ul className="mt-3 flex flex-col divide-y divide-border rounded-xl border border-border">
            {room.rates.map((rate) => (
              <li key={rate.rateKey} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{rate.board.name.charAt(0) + rate.board.name.slice(1).toLowerCase()}</p>
                  <ul className="mt-1 text-sm text-muted-foreground">
                    {cancellationLines(rate.cancellation, currency, rate.from).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-6 sm:justify-end">
                  <HotelPrice amount={rate.from} currency={currency} nights={nights} />
                  <Button
                    type="button"
                    size="cta"
                    disabled={checking}
                    onClick={() => void select(room.name, rate)}
                    aria-label={`Select ${room.name}, ${rate.board.name.toLowerCase()}`}
                  >
                    {checking && chosen?.rate.rateKey === rate.rateKey ? "Checking…" : "Select"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
