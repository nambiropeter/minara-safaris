import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo.mts'

export const Destinations: CollectionConfig = {
  slug: 'destinations',
  access: { read: () => true },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'overview', type: 'richText' },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    seoField,
  ],
}
