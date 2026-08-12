import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: {
    // Staff will upload straight off a phone or a photographer's export, so cap
    // the stored original. sharp runs this in-process before the S3 adapter
    // ships the file to R2 — R2 is plain object storage and transforms nothing.
    // Delivery sizes are next/image's job, so no `imageSizes` variants here.
    // Same numbers as src/scripts/optimize-images.mts.
    resizeOptions: {
      width: 2400,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true,
    },
    formatOptions: {
      format: 'jpeg',
      options: { quality: 82, mozjpeg: true },
    },
    mimeTypes: ['image/*'],
  },
  admin: {
    useAsTitle: 'alt',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
