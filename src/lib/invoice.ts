import type Stripe from "stripe";

/**
 * Fetches the Stripe-generated invoice PDF for a completed Checkout session
 * (sessions are created with `invoice_creation` enabled). Returns null when
 * the session has no finalised invoice yet. Shared by the booking page's
 * download route and the confirmation email, so both serve the same document.
 */
export async function fetchInvoicePdf(
  stripe: Stripe,
  checkoutSessionId: string,
): Promise<Response | null> {
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["invoice"],
  });
  const invoice = typeof session.invoice === "object" ? session.invoice : null;
  const pdfUrl = invoice?.invoice_pdf;
  if (!pdfUrl) return null;

  const res = await fetch(pdfUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Invoice PDF fetch failed with ${res.status}`);
  }
  return res;
}
