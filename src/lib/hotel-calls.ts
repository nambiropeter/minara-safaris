import configPromise from "@payload-config";
import { getPayload } from "payload";

export type HotelCallKind = "availability" | "checkrate" | "booking";

/**
 * Records that a request is about to reach Hotelbeds. Recorded before the call, so a
 * request that fails still counts: Hotelbeds counts it too, and the ratio is theirs to
 * enforce. Never throws: losing a counter row must not fail a customer's search.
 */
export async function recordHotelCall(kind: HotelCallKind): Promise<void> {
  try {
    const payload = await getPayload({ config: configPromise });
    await payload.create({ collection: "hotel-calls", data: { kind } });
  } catch (error) {
    console.error("hotel call record failed", error);
  }
}
