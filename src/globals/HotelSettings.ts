import type { GlobalConfig } from 'payload'

/**
 * Staff-editable hotel settings, so changing the margin or switching hotel search off
 * needs no deploy. `marginPercent` has no default on purpose: until someone saves it
 * the server falls back to HOTEL_MARGIN_BPS, and with neither it refuses to price
 * rather than sell at cost.
 */
export const HotelSettings: GlobalConfig = {
  slug: 'hotel-settings',
  label: 'Hotel settings',
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  admin: { group: 'Hotels' },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Untick to switch hotel search and booking off at once, without a deploy.' },
    },
    {
      name: 'marginPercent',
      type: 'number',
      required: true,
      min: 0,
      max: 100,
      admin: {
        step: 0.5,
        description:
          "Added to Hotelbeds' price before it is shown or charged. 15 means 15%. Takes effect within a minute.",
      },
    },
  ],
}
