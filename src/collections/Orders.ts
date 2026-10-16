import type { CollectionConfig } from 'payload';

import { refundOrder } from './endpoints/refund-order.ts';
import { assertNotRepricingPaidOrder } from './hooks/freeze-paid-orders.ts';

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
  endpoints: [{ path: '/:id/refund', method: 'post', handler: refundOrder }],
  hooks: {
    beforeChange: [
      ({ operation, originalDoc, data }) => {
        if (operation === 'update') {
          assertNotRepricingPaidOrder({ previous: originalDoc, incoming: data });
        }
        return data;
      },
    ],
  },
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
    {
      name: 'supplier',
      type: 'group',
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data?.supplier?.name),
        description: 'The hotel booking behind this order. Written by the server only; the price facts freeze once paid.',
      },
      fields: [
        { name: 'name', type: 'text', admin: { description: 'hotelbeds' } },
        {
          name: 'status',
          type: 'select',
          index: true,
          options: [
            { label: 'Awaiting payment', value: 'pending' },
            { label: 'Booking with the hotel', value: 'booking' },
            { label: 'Booked', value: 'booked' },
            { label: 'Refused: refunded', value: 'failed' },
            { label: 'Unknown: check Hotelbeds by hand', value: 'unknown' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
        },
        { name: 'reference', type: 'text', index: true, admin: { description: 'Hotelbeds booking reference' } },
        { name: 'clientReference', type: 'text', admin: { description: 'Our reference, as sent to Hotelbeds: search for this there if the status is unknown' } },
        { name: 'hotelCode', type: 'number' },
        { name: 'hotelName', type: 'text' },
        { name: 'roomName', type: 'text' },
        { name: 'boardName', type: 'text' },
        { type: 'row', fields: [{ name: 'checkIn', type: 'text' }, { name: 'checkOut', type: 'text' }] },
        { name: 'guests', type: 'json' },
        { name: 'rateKey', type: 'textarea', admin: { description: 'Opaque Hotelbeds key, kept exactly as received' } },
        { name: 'netAmount', type: 'number', admin: { description: 'EUR, major units: what Hotelbeds quoted before payment' } },
        { name: 'bookedNetAmount', type: 'number', admin: { description: 'EUR, major units: what Hotelbeds actually booked at' } },
        { name: 'marginBps', type: 'number', admin: { description: 'Basis points: 1500 is 15%' } },
        { type: 'row', fields: [{ name: 'fxEurPerKes', type: 'number' }, { name: 'fxUsdPerKes', type: 'number' }] },
        {
          name: 'cancellationPolicies',
          type: 'array',
          admin: { description: 'A fee applies from each date. Amounts are what the customer is charged, in minor units of the order currency.' },
          fields: [
            { name: 'from', type: 'text', required: true },
            { name: 'amount', type: 'number', required: true },
          ],
        },
        { name: 'rateComments', type: 'textarea', admin: { description: 'Check-in hours, deposits, minimum age. Shown to the guest.' } },
        { name: 'payableTo', type: 'text', admin: { description: 'The legal entity the guest is told they pay through' } },
        { name: 'note', type: 'textarea', admin: { description: 'Why a booking failed, or what to check' } },
      ],
    },
    { name: 'accessTokenHash', type: 'text', index: true, unique: true, admin: { hidden: true } },
    { name: 'invoice', type: 'upload', relationTo: 'media' },
    { name: 'staffNotes', type: 'textarea' },
    {
      name: 'refund',
      type: 'ui',
      admin: { components: { Field: '@/components/admin/refund-order#RefundOrder' } },
    },
  ],
};
