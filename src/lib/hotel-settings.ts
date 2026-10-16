import configPromise from "@payload-config";
import { getPayload } from "payload";

/**
 * Hotel settings from the admin global, with HOTEL_MARGIN_BPS as the bootstrap fallback
 * until someone saves a margin there. With neither, `marginBps` is null and callers
 * refuse to price: a missing margin must never quietly mean selling at cost.
 *
 * ponytail: remembered for a minute per process, so a staff edit takes up to a minute to
 * reach every instance. Cheaper than a database read on every search; shorten if staff
 * need instant changes.
 */
const TTL_MS = 60_000;

export type HotelSettings = { enabled: boolean; marginBps: number | null };

let memo: { at: number; settings: HotelSettings } | null = null;

/** Percent in the admin (12.5) to whole basis points (1250). */
export const percentToBps = (percent: number) => Math.round(percent * 100);

function envMarginBps(): number | null {
  const raw = process.env.HOTEL_MARGIN_BPS;
  const bps = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isInteger(bps) && bps >= 0 ? bps : null;
}

export async function getHotelSettings(now = Date.now()): Promise<HotelSettings> {
  if (memo && now - memo.at < TTL_MS) return memo.settings;

  let enabled = true;
  let marginBps: number | null = null;
  try {
    const payload = await getPayload({ config: configPromise });
    const doc = await payload.findGlobal({ slug: "hotel-settings", depth: 0 });
    enabled = doc.enabled !== false;
    if (typeof doc.marginPercent === "number") marginBps = percentToBps(doc.marginPercent);
  } catch (error) {
    // Settings unreadable: keep serving on the env margin rather than failing every search.
    console.error("hotel settings read failed", error);
  }

  const settings = { enabled, marginBps: marginBps ?? envMarginBps() };
  memo = { at: now, settings };
  return settings;
}

/** For tests, and for anything that must see a staff change immediately. */
export function resetHotelSettingsMemo() {
  memo = null;
}
