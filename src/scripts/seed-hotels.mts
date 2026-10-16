import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Additive development seed for the "choose your own hotel" packages. `pnpm seed:hotels`
 *
 * Unlike `seed.mts` this never deletes. It creates what is missing (matched by slug or
 * filename) and sets the hotel area on existing destinations, so articles, leads and orders
 * and anything typed into the admin are left alone. Safe to run twice.
 *
 * EVERY VALUE HERE IS SYNTHETIC, the prices especially. None of it is a Minara quote, and
 * none of it claims a licence, badge, testimonial or traveller count (PRODUCT.md). Delete
 * before launch with the rest of the seed content (docs/WORK-PLAN.md Phase 6). The photos are
 * Wikimedia Commons placeholders; credits are in public/images/README.md.
 *
 * Needs the `accommodation` and `hotelDestination` columns, so apply the migrations first.
 */

const dirname = path.dirname(fileURLToPath(import.meta.url))
const imageDir = path.resolve(dirname, '../../public/images')

const images = {
  lions: { file: 'lions-masai-mara.jpg', alt: 'A pride of lions resting in the grass of the Maasai Mara' },
  diani: { file: 'diani-beach-sunrise.jpg', alt: 'Sunrise over the white sand of Diani Beach' },
  nakuru: { file: 'rhinos-lake-nakuru.jpg', alt: 'White rhinos grazing among bushes in Lake Nakuru National Park' },
  kilimanjaro: { file: 'amboseli-kilimanjaro.jpg', alt: 'Mount Kilimanjaro rising behind the plains of Amboseli' },
  giraffe: { file: 'giraffe-nairobi-skyline.jpg', alt: 'A giraffe in Nairobi National Park with the city skyline behind it' },
  fortJesus: { file: 'fort-jesus-mombasa.jpg', alt: 'The coral stone walls of Fort Jesus in Mombasa' },
  naivasha: { file: 'lake-naivasha.jpg', alt: 'The shore of Lake Naivasha at the edge of the Rift Valley' },
} as const

type ImageKey = keyof typeof images

/** Existing destinations get a hotel area; the rest are created if missing. */
const destinations: { name: string; slug: string; hotelDestination: 'nairobi' | 'maasai-mara' | 'mombasa' | 'diani' | 'nakuru' | 'naivasha' | 'amboseli' | 'tsavo'; image?: ImageKey }[] = [
  { name: 'Maasai Mara', slug: 'maasai-mara', hotelDestination: 'maasai-mara' },
  { name: 'Amboseli', slug: 'amboseli', hotelDestination: 'amboseli' },
  { name: 'Tsavo', slug: 'tsavo', hotelDestination: 'tsavo' },
  { name: 'Diani & the coast', slug: 'diani-coast', hotelDestination: 'diani' },
  { name: 'Nairobi', slug: 'nairobi', hotelDestination: 'nairobi', image: 'giraffe' },
  { name: 'Mombasa', slug: 'mombasa', hotelDestination: 'mombasa', image: 'fortJesus' },
  { name: 'Lake Nakuru', slug: 'lake-nakuru', hotelDestination: 'nakuru', image: 'nakuru' },
  { name: 'Lake Naivasha', slug: 'lake-naivasha', hotelDestination: 'naivasha', image: 'naivasha' },
]

type SeedPackage = {
  title: string
  slug: string
  durationDays: number
  priceFrom: number
  priceResident?: number
  summary: string
  destinations: string[]
  tags: string[]
  image: ImageKey
  itinerary: { day: number; title: string; description: string }[]
  inclusions: string[]
  exclusions: string[]
}

const NOTE = 'per person sharing, non-resident, low season, land only: hotel not included'

const packages: SeedPackage[] = [
  {
    title: 'Maasai Mara Game Drives, Land Only',
    slug: 'mara-game-drives-land-only',
    durationDays: 3,
    priceFrom: 34000,
    priceResident: 21000,
    summary: 'Three days of game drives in the Mara. You choose and book where you sleep, from a budget camp to a luxury tent.',
    destinations: ['maasai-mara'],
    tags: ['safari', 'flexible'],
    image: 'lions',
    itinerary: [
      { day: 1, title: 'Into the Mara', description: 'Transfer from Nairobi to the reserve and an afternoon drive until the light goes.' },
      { day: 2, title: 'A full day in the reserve', description: 'Early drive for the cats, a break in the heat of the day, and out again at four.' },
      { day: 3, title: 'Morning drive and return', description: 'A last drive on the way out, lunch on the road, back in Nairobi by evening.' },
    ],
    inclusions: ['Park entry fees', 'Transport in a 4x4 with a pop-up roof', 'Driver-guide', 'Drinking water', 'Pick-up and drop-off at your Mara hotel'],
    exclusions: ['Accommodation', 'Meals', 'Flights', 'Balloon safari', 'Tips'],
  },
  {
    title: 'Diani Beach Days, Land Only',
    slug: 'diani-beach-days-land-only',
    durationDays: 4,
    priceFrom: 28000,
    priceResident: 17500,
    summary: 'A coast week built around the days out: dolphins at Kisite, the Shimba Hills and the colobus monkeys. Pick your own beach hotel.',
    destinations: ['diani-coast'],
    tags: ['beach', 'flexible', 'family'],
    image: 'diani',
    itinerary: [
      { day: 1, title: 'Arrive on the coast', description: 'Transfer from the airport or Ukunda to your hotel. Nothing else scheduled.' },
      { day: 2, title: 'Kisite and Wasini by dhow', description: 'A morning on the water looking for dolphins, snorkelling over the reef, lunch on Wasini island.' },
      { day: 3, title: 'Shimba Hills', description: 'Sable antelope and forest walks, back in time for the beach.' },
      { day: 4, title: 'Departure', description: 'Transfer to the airport.' },
    ],
    inclusions: ['Airport and hotel transfers', 'Dhow trip to Kisite and Wasini', 'Shimba Hills day trip', 'Driver-guide'],
    exclusions: ['Accommodation', 'Marine park fees', 'Meals not mentioned', 'Flights', 'Tips'],
  },
  {
    title: 'Lake Nakuru and Naivasha, Land Only',
    slug: 'nakuru-naivasha-land-only',
    durationDays: 2,
    priceFrom: 18500,
    priceResident: 11000,
    summary: 'Rhino and flamingo at Nakuru, then cycling through Hell\'s Gate at Naivasha. Book your own lodge on the lake.',
    destinations: ['lake-nakuru', 'lake-naivasha'],
    tags: ['safari', 'short break', 'flexible'],
    image: 'nakuru',
    itinerary: [
      { day: 1, title: 'Down the escarpment to Nakuru', description: 'The viewpoint over the Rift Valley, then an afternoon drive for rhino.' },
      { day: 2, title: 'Naivasha and Hell\'s Gate', description: 'Hire bikes inside the gorge, then a boat out on the lake before the road back to Nairobi.' },
    ],
    inclusions: ['Park entry fees', 'Transport', 'Driver-guide', 'Bicycle hire at Hell\'s Gate'],
    exclusions: ['Accommodation', 'Meals', 'Boat ride on the lake', 'Tips'],
  },
  {
    title: 'Amboseli and Kilimanjaro Views, Land Only',
    slug: 'amboseli-kilimanjaro-land-only',
    durationDays: 3,
    priceFrom: 39000,
    priceResident: 24000,
    summary: 'Elephants with Kilimanjaro behind them. The drives and the transport are sorted; you choose the lodge.',
    destinations: ['amboseli'],
    tags: ['safari', 'photography', 'flexible'],
    image: 'kilimanjaro',
    itinerary: [
      { day: 1, title: 'Nairobi to Amboseli', description: 'The long road south, into the park for an evening drive.' },
      { day: 2, title: 'Dawn on the plains', description: 'Out before sunrise while the mountain is clear, a full day among the elephant herds.' },
      { day: 3, title: 'Last drive and home', description: 'A morning drive, then the road back to Nairobi.' },
    ],
    inclusions: ['Park entry fees', '4x4 transport', 'Driver-guide', 'Drinking water'],
    exclusions: ['Accommodation', 'Meals', 'Flights', 'Tips'],
  },
  {
    title: 'Nairobi Wildlife Day, Land Only',
    slug: 'nairobi-wildlife-day-land-only',
    durationDays: 1,
    priceFrom: 9500,
    priceResident: 5500,
    summary: 'Giraffes with a city skyline behind them. A single day for a layover or a first morning in Kenya.',
    destinations: ['nairobi'],
    tags: ['day trip', 'family', 'flexible'],
    image: 'giraffe',
    itinerary: [
      { day: 1, title: 'Nairobi National Park and the Giraffe Centre', description: 'A morning game drive inside the park, then feed the Rothschild giraffes at the centre.' },
    ],
    inclusions: ['Park entry fee', 'Giraffe Centre entry', 'Transport from your hotel', 'Driver-guide'],
    exclusions: ['Accommodation', 'Meals', 'Tips'],
  },
  {
    title: 'Mombasa Old Town and Fort Jesus, Land Only',
    slug: 'mombasa-old-town-land-only',
    durationDays: 1,
    priceFrom: 8500,
    priceResident: 4800,
    summary: 'The coral stone fort, the alleys of the old town and the spice market, with a local guide.',
    destinations: ['mombasa'],
    tags: ['culture', 'day trip', 'flexible'],
    image: 'fortJesus',
    itinerary: [
      { day: 1, title: 'Fort Jesus and the old town', description: 'The fort and its museum in the morning, a walk through the old town and lunch near the harbour.' },
    ],
    inclusions: ['Fort Jesus entry', 'Transport from your hotel', 'Local guide'],
    exclusions: ['Accommodation', 'Meals', 'Tips'],
  },
]

const seed = async () => {
  if (process.env.SEED_HOTELS !== '1') {
    throw new Error('Set SEED_HOTELS=1 to run this. It writes synthetic content to whichever database DATABASE_URI points at.')
  }

  const payload = await getPayload({ config })

  const mediaIds = new Map<ImageKey, number>()
  for (const [key, image] of Object.entries(images) as [ImageKey, (typeof images)[ImageKey]][]) {
    const existing = await payload.find({ collection: 'media', where: { filename: { equals: image.file } }, limit: 1, depth: 0 })
    if (existing.docs[0]) {
      mediaIds.set(key, existing.docs[0].id)
      continue
    }
    const doc = await payload.create({ collection: 'media', data: { alt: image.alt }, filePath: path.join(imageDir, image.file) })
    mediaIds.set(key, doc.id)
    payload.logger.info(`media: created ${image.file}`)
  }

  const destinationIds = new Map<string, number>()
  for (const destination of destinations) {
    const found = await payload.find({ collection: 'destinations', where: { slug: { equals: destination.slug } }, limit: 1, depth: 0 })
    const doc = found.docs[0]
    if (doc) {
      destinationIds.set(destination.slug, doc.id)
      if (doc.hotelDestination !== destination.hotelDestination) {
        await payload.update({ collection: 'destinations', id: doc.id, data: { hotelDestination: destination.hotelDestination } })
        payload.logger.info(`destination: mapped ${destination.slug} to hotel area ${destination.hotelDestination}`)
      }
      continue
    }
    const created = await payload.create({
      collection: 'destinations',
      data: {
        name: destination.name,
        slug: destination.slug,
        hotelDestination: destination.hotelDestination,
        coverImage: destination.image ? mediaIds.get(destination.image) : undefined,
      },
    })
    destinationIds.set(destination.slug, created.id)
    payload.logger.info(`destination: created ${destination.slug}`)
  }

  for (const pkg of packages) {
    const found = await payload.find({ collection: 'packages', where: { slug: { equals: pkg.slug } }, limit: 1, depth: 0 })
    if (found.docs[0]) continue
    await payload.create({
      collection: 'packages',
      data: {
        title: pkg.title,
        slug: pkg.slug,
        accommodation: 'choose-your-own',
        durationDays: pkg.durationDays,
        priceFrom: pkg.priceFrom,
        priceNote: NOTE,
        priceResident: pkg.priceResident,
        currency: 'KES',
        summary: pkg.summary,
        itinerary: pkg.itinerary,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        tags: pkg.tags,
        destinations: pkg.destinations.map((slug, index) => ({ destination: destinationIds.get(slug)!, isPrimary: index === 0 })),
        images: [{ image: mediaIds.get(pkg.image)!, isCover: true }],
        isFeatured: false,
        isPublished: true,
      },
    })
    payload.logger.info(`package: created ${pkg.slug}`)
  }

  payload.logger.info('Hotel seed done. All synthetic — delete before launch.')
  process.exit(0)
}

await seed()
