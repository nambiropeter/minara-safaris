import type { CollectionConfig } from 'payload'

/**
 * Shared cache for Hotelbeds availability and rates. Identical lookups are served from
 * here so look-to-book only counts distinct ones, and it lives in Postgres (not process
 * memory) so every serverless instance sees the same entries. Written only by the server
 * through the local API; expired rows are purged on write, so staff never need to look.
 */
export const HotelCache: CollectionConfig = {
  slug: 'hotel-cache',
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: () => false },
  admin: { useAsTitle: 'key', defaultColumns: ['key', 'expiresAt'], hidden: true },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    // Always `{ value }`: a lookup with no result is a real answer worth caching, and a JSON field can't be null.
    { name: 'body', type: 'json', required: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}
