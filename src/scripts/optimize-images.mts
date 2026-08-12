import { readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

/**
 * Downscale local images in place. `pnpm optimize:images [dir]`
 *
 * This is for the placeholder photography in `public/images` — stock files come
 * off Pexels at 5000px and 5MB, which bloats the repo and makes Next's image
 * optimizer chew a source nobody will ever view at that size.
 *
 * Uploads through the admin do NOT need this: `Media.upload.resizeOptions` in
 * src/collections/Media.ts applies the same cap before the file reaches R2.
 * Keep the two sets of numbers in sync.
 */

const MAX_EDGE = 2400
const QUALITY = 82

const dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(process.argv[2] ?? path.join(dirname, '../../public/images'))

const kb = (bytes: number) => `${Math.round(bytes / 1024)}K`

const files = (await readdir(target)).filter((f) => /\.(jpe?g|png)$/i.test(f))
let saved = 0

for (const file of files) {
  const filePath = path.join(target, file)
  const input = await readFile(filePath)
  const { width = 0, height = 0 } = await sharp(input).metadata()

  if (Math.max(width, height) <= MAX_EDGE) {
    console.log(`  skip  ${file} — ${width}×${height}, already under ${MAX_EDGE}px`)
    continue
  }

  // Re-encode in the format it arrived in — writing JPEG bytes into a .png is
  // the kind of thing that only breaks three tools later.
  const resized = sharp(input).resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  })
  const output = await (file.toLowerCase().endsWith('.png')
    ? resized.png({ compressionLevel: 9 })
    : resized.jpeg({ quality: QUALITY, mozjpeg: true })
  ).toBuffer()

  // Only write when it actually helps — a re-encode that grows the file is a
  // quality loss for nothing.
  if (output.length >= input.length) {
    console.log(`  skip  ${file} — re-encode was larger`)
    continue
  }

  await writeFile(filePath, output)
  saved += input.length - output.length
  console.log(`  done  ${file} — ${width}×${height} ${kb(input.length)} → ${kb(output.length)}`)
}

console.log(`\n${files.length} file(s) in ${target}, ${kb(saved)} saved.`)
