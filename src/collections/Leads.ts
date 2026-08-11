import type { CollectionConfig } from 'payload'

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
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'text' },
      ],
    },
    { name: 'package', type: 'relationship', relationTo: 'packages' },
    { name: 'travelDates', type: 'text' },
    { name: 'travellers', type: 'number', min: 1 },
    { name: 'message', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: ['new', 'contacted', 'closed'],
    },
    { name: 'source', type: 'text', admin: { description: 'Landing page path' } },
    { name: 'referrer', type: 'text' },
    {
      name: 'utm',
      type: 'group',
      fields: [
        { name: 'source', type: 'text' },
        { name: 'medium', type: 'text' },
        { name: 'campaign', type: 'text' },
      ],
    },
  ],
}
