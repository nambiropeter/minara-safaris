import type { CollectionConfig } from 'payload'
import { seoField } from '../fields/seo.mts'
import { slugField } from '../fields/slug.mts'

export const Packages: CollectionConfig = {
  slug: 'packages',
  access: { read: () => true },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'isPublished', 'isFeatured', 'priceFrom'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    { name: 'durationDays', type: 'number', required: true, min: 1 },
    {
      type: 'row',
      fields: [
        { name: 'priceFrom', type: 'number', required: true, min: 0 },
        // Never render a bare price — priceNote is required alongside it.
        { name: 'priceNote', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'priceResident', type: 'number', min: 0, admin: { description: 'KE/EA resident rate, where it differs' } },
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'KES',
          options: ['KES', 'USD'],
        },
      ],
    },
    { name: 'offerLabel', type: 'text', admin: { description: 'e.g. "Easter Special" — drives the homepage deals strip' } },
    { name: 'summary', type: 'textarea', required: true, admin: { description: 'Short teaser for cards' } },
    { name: 'description', type: 'richText' },
    {
      name: 'itinerary',
      type: 'array',
      fields: [
        { name: 'day', type: 'number', required: true, min: 1 },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
    { name: 'inclusions', type: 'text', hasMany: true, admin: { description: 'What\'s included, one line per item, e.g. "Park entry fees"' } },
    { name: 'exclusions', type: 'text', hasMany: true, admin: { description: 'What\'s not included, one line per item, e.g. "International flights"' } },
    { name: 'tags', type: 'text', hasMany: true, admin: { description: 'Trip style: safari, beach, honeymoon, family, etc.' } },
    {
      name: 'destinations',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { description: 'Combo tours (e.g. Kenya+Tanzania) are a real product — add every destination this package visits' },
      fields: [
        { name: 'destination', type: 'relationship', relationTo: 'destinations', required: true },
        { name: 'isPrimary', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'images',
      type: 'array',
      admin: { description: 'Order here is display order' },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'isCover', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'ogImage', type: 'upload', relationTo: 'media', admin: { description: 'Image used for social/link previews (not yet wired up on the site)' } },
    {
      type: 'row',
      fields: [
        { name: 'isFeatured', type: 'checkbox', defaultValue: false, admin: { description: 'Shows this package on the homepage' } },
        { name: 'isPublished', type: 'checkbox', defaultValue: false, admin: { description: 'Off = hidden from the public site entirely' } },
      ],
    },
    seoField,
  ],
}
