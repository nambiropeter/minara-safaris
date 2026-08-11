import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo.mts'

export const Articles: CollectionConfig = {
  slug: 'articles',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'excerpt', type: 'textarea', required: true },
    { name: 'body', type: 'richText', required: true },
    { name: 'coverImage', type: 'upload', relationTo: 'media', required: true },
    { name: 'tags', type: 'text', hasMany: true },
    { name: 'publishedAt', type: 'date' },
    seoField,
  ],
}
