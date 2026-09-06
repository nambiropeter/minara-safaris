import type { CollectionConfig } from "payload";

/**
 * Webhook idempotency ledger. Stripe retries deliveries; inserting the event id
 * before doing any work is what stops a retry fulfilling an order twice.
 */
export const ProcessedEvents: CollectionConfig = {
  slug: "processed-events",
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: () => false },
  admin: { useAsTitle: "eventId", defaultColumns: ["eventId", "type", "createdAt"], hidden: true },
  fields: [
    { name: "eventId", type: "text", required: true, unique: true, index: true },
    { name: "type", type: "text", required: true },
  ],
};
