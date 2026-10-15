import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { Leads } from '@/collections/Leads'

/** Named fields, looking inside layout wrappers like `row`. */
function namedFields(fields: Field[]): Field[] {
  return fields.flatMap((f) => ('fields' in f && !('name' in f) ? namedFields(f.fields) : [f]))
}

const byName = Object.fromEntries(
  namedFields(Leads.fields).map((f) => [(f as { name?: string }).name, f]),
)

const canEdit = (name: string) => {
  const update = (byName[name] as { access?: { update?: (a: never) => boolean } }).access?.update
  return update ? update({} as never) : true
}

describe('Leads field access', () => {
  it.each(['name', 'email', 'phone', 'package', 'travelDates', 'travellers', 'message', 'source', 'referrer', 'utm'])(
    'locks %s: staff read what the customer sent but cannot rewrite it',
    (name) => {
      expect(byName[name], `${name} should exist`).toBeDefined()
      expect(canEdit(name)).toBe(false)
    },
  )

  it('keeps status editable, because working through enquiries is what staff do', () => {
    expect(canEdit('status')).toBe(true)
  })

  it('still lets staff delete a lead (spam, data-removal requests)', () => {
    expect(Leads.access?.delete?.({ req: { user: { id: 1 } } } as never)).toBe(true)
  })
})
