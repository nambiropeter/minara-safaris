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
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      admin: { description: 'Short teaser shown on the journal list and in search/social previews.' },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      admin: { description: 'The full article content.' },
    },
    { name: 'coverImage', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: { description: 'Free-text labels for grouping related articles (not shown to visitors).' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { description: 'Controls the date shown on the article — does not affect visibility.' },
    },
    seoField,
  ],
}
