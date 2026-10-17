"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { id: number | string; amount: string };

/**
 * Two clicks on purpose: this moves real money and cannot be undone. Plain elements
 * with Payload's own button classes, so the admin looks native without importing
 * @payloadcms/ui.
 */
export function RefundButton({ id, amount }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "working" | "done">("idle");
  const [error, setError] = useState("");
  // What the server actually refunded: for a bundle whose hotel was already refunded, less than the order total.
  const [sent, setSent] = useState(amount);

  async function refund() {
    setStep("working");
    setError("");
    try {
      const res = await fetch(`/api/orders/${id}/refund`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStep("confirm");
        return;
      }
      if (typeof data.amount === "string") setSent(data.amount);
      setStep("done");
      // Stripe tells our webhook a moment later; that is what flips the status.
      setTimeout(() => router.refresh(), 3000);
    } catch {
      setError("Something went wrong.");
      setStep("confirm");
    }
  }

  return (
    <div style={{ marginBottom: "var(--base)" }}>
      <h4 style={{ marginBottom: "calc(var(--base) / 2)" }}>Refund</h4>

      {step === "done" ? (
        <p>
          Refund of {sent} sent to Stripe. This order will show as refunded in a few seconds.
        </p>
      ) : (
        <>
          <p style={{ marginBottom: "calc(var(--base) / 2)", color: "var(--theme-elevation-500)" }}>
            Refunds the customer in full through Stripe. It cannot be undone, and Stripe keeps its
            processing fee.
          </p>

          {step === "idle" ? (
            <button type="button" className="btn btn--style-secondary btn--size-medium" onClick={() => setStep("confirm")}>
              Refund {amount}…
            </button>
          ) : (
            <div style={{ display: "flex", gap: "calc(var(--base) / 2)", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn--style-primary btn--size-medium"
                disabled={step === "working"}
                onClick={refund}
              >
                {step === "working" ? "Refunding…" : `Yes, refund ${amount}`}
              </button>
              <button
                type="button"
                className="btn btn--style-secondary btn--size-medium"
                disabled={step === "working"}
                onClick={() => setStep("idle")}
              >
                Cancel
              </button>
            </div>
          )}

          {error && <p style={{ color: "var(--theme-error-500)", marginTop: "var(--base)" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
