import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo.mts'
import { slugField } from '../fields/slug.mts'

export const Articles: CollectionConfig = {
  slug: 'articles',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'isFeatured', 'publishedAt'],
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
      type: 'row',
      fields: [
        {
          name: 'tags',
          type: 'text',
          hasMany: true,
          admin: { description: 'Free-text labels for grouping related articles (e.g. Planning, Wildlife).' },
        },
        {
          name: 'readTimeMinutes',
          type: 'number',
          min: 1,
          admin: { description: 'Estimated read time in minutes (e.g. 5)' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'isFeatured',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Features this article prominently in the journal' },
        },
        {
          name: 'publishedAt',
          type: 'date',
          admin: { description: 'Controls the date shown on the article — does not affect visibility.' },
        },
      ],
    },
    seoField,
  ],
}
