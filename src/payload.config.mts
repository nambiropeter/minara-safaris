import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Articles } from './collections/Articles'
import { Destinations } from './collections/Destinations'
import { Leads } from './collections/Leads'
import { Media } from './collections/Media'
import { Packages } from './collections/Packages'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

function resolveSecret() {
  const secret = process.env.PAYLOAD_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV !== 'production') return 'minara-safaris-dev-secret'
  throw new Error('Missing PAYLOAD_SECRET. Set it in the production environment.')
}

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Users, Media, Destinations, Packages, Articles, Pages, Leads],
  editor: lexicalEditor(),
  secret: resolveSecret(),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  plugins: [
    s3Storage({
      // Falls back to local disk until R2 credentials are set — see .env.example.
      enabled: Boolean(process.env.R2_BUCKET),
      collections: { media: true },
      bucket: process.env.R2_BUCKET || '',
      config: {
        region: 'auto',
        endpoint: process.env.R2_ACCOUNT_ID
          ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
          : undefined,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        forcePathStyle: true,
      },
    }),
  ],
  sharp,
})
