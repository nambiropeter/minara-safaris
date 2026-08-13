import type { Field } from 'payload'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Free-typed slug fields have no built-in normalization in Payload — this is
 * the documented beforeValidate-hook pattern. Auto-fills from `sourceField`
 * when left blank, and re-slugifies whatever's typed (fixes stray whitespace,
 * capitals, spaces) rather than trusting the raw input.
 */
export function slugField(sourceField: string): Field {
  return {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    index: true,
    admin: {
      description: `Auto-filled from ${sourceField} if left blank. Whatever you type is normalized to lowercase-with-hyphens on save.`,
    },
    hooks: {
      beforeValidate: [
        ({ value, siblingData }) => {
          const source = typeof value === 'string' && value.trim() ? value : siblingData?.[sourceField]
          return typeof source === 'string' ? slugify(source) : value
        },
      ],
    },
  }
}
