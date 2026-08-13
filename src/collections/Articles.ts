import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo.mts'
import { slugField } from '../fields/slug.mts'

export const Articles: CollectionConfig = {
  slug: 'articles',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'excerpt', type: 'textarea', required: true },
    { name: 'body', type: 'richText', required: true },
    { name: 'coverImage', type: 'upload', relationTo: 'media', required: true },
    { name: 'tags', type: 'text', hasMany: true },
    { name: 'publishedAt', type: 'date' },
    seoField,
  ],
}
