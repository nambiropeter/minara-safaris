import type { CollectionConfig } from 'payload'

/**
 * What a visitor sent is a record, not a draft: staff read it but cannot rewrite it.
 * Only `status` stays editable. Field-level access applies to the admin and the REST
 * API alike; the POST /api/leads route writes through the Local API, which bypasses it.
 */
const locked = { access: { update: () => false } }

export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'status', 'createdAt'],
  },
  // Leads are written by the hand-written POST /api/leads route via the Local API
  // (which bypasses access control by default) — never through Payload's own REST API.
  access: {
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, ...locked },
        { name: 'email', type: 'email', required: true, ...locked },
        { name: 'phone', type: 'text', ...locked },
      ],
    },
    { name: 'package', type: 'relationship', relationTo: 'packages', ...locked },
    { name: 'travelDates', type: 'text', ...locked },
    { name: 'travellers', type: 'number', min: 1, ...locked },
    { name: 'message', type: 'textarea', ...locked },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: ['new', 'contacted', 'closed'],
    },
    { name: 'source', type: 'text', admin: { description: 'Landing page path' }, ...locked },
    { name: 'referrer', type: 'text', ...locked },
    {
      name: 'utm',
      type: 'group',
      ...locked,
      fields: [
        { name: 'source', type: 'text' },
        { name: 'medium', type: 'text' },
        { name: 'campaign', type: 'text' },
      ],
    },
  ],
}
