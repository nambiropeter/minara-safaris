import type { CollectionConfig } from 'payload'

/**
 * One row per request that actually reached Hotelbeds (cache hits are not recorded).
 * Look-to-book is contractual, and this is what it is measured from: availability
 * requests divided by bookings. Filter by kind and date in the list view.
 */
export const HotelCalls: CollectionConfig = {
  slug: 'hotel-calls',
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: () => false },
  admin: {
    group: 'Hotels',
    useAsTitle: 'kind',
    defaultColumns: ['kind', 'createdAt'],
    description: 'Requests sent to Hotelbeds. Look-to-book is availability requests divided by bookings.',
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Availability (search or rates)', value: 'availability' },
        { label: 'CheckRate', value: 'checkrate' },
        { label: 'Booking', value: 'booking' },
      ],
    },
  ],
}
