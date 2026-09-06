import Stripe from "stripe";

/**
 * Pinned deliberately. Without an explicit apiVersion the account's dashboard
 * default applies, so someone clicking "upgrade" in Stripe could change the
 * shape of responses this code parses without a single line changing here.
 *
 * This is the version stripe@22.6.1 targets. If the SDK is upgraded, read the
 * new value from `require("stripe").Stripe.API_VERSION` and bump this together
 * with the SDK — TypeScript rejects any literal the installed SDK doesn't know.
 */
const STRIPE_API_VERSION = "2026-08-26.dahlia";

/**
 * Returns null until STRIPE_SECRET_KEY exists, matching the no-op pattern in
 * `notify-lead.ts` so local work without credentials still builds.
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}
