import type { CollectionConfig } from 'payload'
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
    seoField,
  ],
}
