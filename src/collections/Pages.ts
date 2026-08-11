import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo.mts'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'slug',
      type: 'select',
      required: true,
      unique: true,
      options: ['about', 'contact', 'faqs', 'terms', 'privacy'],
    },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'richText', required: true },
    seoField,
  ],
}
