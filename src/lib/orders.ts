import { getPayload } from "payload";

import configPromise from "@payload-config";
import type { Order } from "@/payload-types";
import { hashBookingToken } from "./booking-token";

/** Looks up by hash, so the plaintext token is never compared against storage. */
export async function findOrderByToken(token: string): Promise<Order | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const payload = await getPayload({ config: configPromise });
  const result = await payload.find({
    collection: "orders",
    where: { accessTokenHash: { equals: hashBookingToken(token) } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  return result.docs[0] ?? null;
}
