"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls router.refresh() while an order is in 'pending' status so that
 * when the Stripe webhook settles the order asynchronously, the booking page
 * automatically transitions to 'paid' without requiring a manual browser refresh.
 */
export function BookingStatusPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 2500);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);

  return null;
}
