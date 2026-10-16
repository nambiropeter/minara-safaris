import { describe, expect, it } from 'vitest'

import { Orders } from '@/collections/Orders'

describe('Orders refund wiring', () => {
  it('exposes a staff refund endpoint at POST /:id/refund', () => {
    const endpoint = Array.isArray(Orders.endpoints)
      ? Orders.endpoints.find((e) => e.path === '/:id/refund')
      : undefined
    expect(endpoint?.method).toBe('post')
  })

  it('shows the refund panel in the admin edit view through a ui field', () => {
    const field = Orders.fields.find((f) => 'name' in f && f.name === 'refund')
    expect(field).toMatchObject({
      type: 'ui',
      admin: { components: { Field: '@/components/admin/refund-order#RefundOrder' } },
    })
  })
})
