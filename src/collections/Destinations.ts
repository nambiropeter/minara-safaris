import type { CollectionConfig } from 'payload'
import { HOTEL_DESTINATIONS } from '../lib/hotel-destinations.ts'
import { seoField } from '../fields/seo.mts'
import { slugField } from '../fields/slug.mts'

export const Destinations: CollectionConfig = {
  slug: 'destinations',
  access: { read: () => true },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'overview', type: 'richText', admin: { description: 'Shown on the destination page above the list of packages that visit it.' } },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    {
      name: 'hotelDestination',
      type: 'select',
      options: HOTEL_DESTINATIONS.map((d) => ({ label: d.label, value: d.slug })),
      admin: {
        description:
          'Where /hotels searches for guests on a "choose your own hotel" package that visits here. Leave empty to offer no hotel search.',
      },
    },
    seoField,
  ],
}
