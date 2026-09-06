import type { CollectionConfig } from 'payload';

/**
 * The order record is also the CRM — Payload's list view, filters and query
 * presets are the whole customer database at this volume.
 *
 * `items` is a snapshot taken when the order is created and never re-read from
 * the package. A later price edit in the admin must not change what a customer
 * already agreed to pay.
 */
export const Orders: CollectionConfig = {
  slug: 'orders',
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // server-side only, via the local API
    update: ({ req }) => Boolean(req.user),
    delete: () => false,
  },
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'customerEmail', 'amountTotal', 'createdAt'],
  },
  enableQueryPresets: true,
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: ['pending', 'paid', 'confirmed', 'cancelled', 'refunded', 'failed'],
    },
    {
      type: 'row',
      fields: [
        { name: 'customerName', type: 'text' },
        { name: 'customerEmail', type: 'email', required: true, index: true },
        { name: 'customerPhone', type: 'text' },
      ],
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      admin: { readOnly: true, description: 'Price snapshot. Never re-read from the package.' },
      fields: [
        { name: 'kind', type: 'select', required: true, options: ['package', 'hotel'] },
        { name: 'refId', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'unitAmount', type: 'number', required: true, admin: { description: 'Minor units' } },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'subtotal', type: 'number', required: true, admin: { description: 'Minor units' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'currency', type: 'select', required: true, defaultValue: 'KES', options: ['KES', 'USD', 'GBP'] },
        { name: 'amountTotal', type: 'number', required: true, admin: { readOnly: true, description: 'Minor units' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'travelDate', type: 'date' },
        { name: 'adults', type: 'number', min: 1 },
        { name: 'children', type: 'number', min: 0 },
      ],
    },
    {
      name: 'stripe',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        { name: 'checkoutSessionId', type: 'text', index: true },
        { name: 'paymentIntentId', type: 'text' },
      ],
    },
    { name: 'accessTokenHash', type: 'text', index: true, unique: true, admin: { hidden: true } },
    { name: 'invoice', type: 'upload', relationTo: 'media' },
    { name: 'staffNotes', type: 'textarea' },
  ],
};
