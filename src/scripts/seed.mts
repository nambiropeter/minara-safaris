import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Development seed. `pnpm seed`
 *
 * EVERY VALUE HERE IS SYNTHETIC — the prices especially. They exist so the
 * design can be judged against real-shaped content instead of empty states, and
 * so staff have something to click in the admin. None of it is a Minara quote.
 * Delete it before launch; see docs/WORK-PLAN.md Phase 6.
 *
 * No testimonials, licence numbers, association badges or traveller counts are
 * seeded, because those are claims rather than content (PRODUCT.md).
 */

const dirname = path.dirname(fileURLToPath(import.meta.url))
const imageDir = path.resolve(dirname, '../../public/images')

const images = [
  { file: 'cheetah-mara-game-drive.jpg', alt: 'A cheetah sits in long grass while safari vehicles wait on the horizon' },
  { file: 'zebra-herd-savanna.jpg', alt: 'A herd of zebra crossing dry golden grassland' },
  { file: 'zebra-impala-hills.jpg', alt: 'Zebra and impala grazing with misty hills behind' },
  { file: 'safari-vehicle-acacia-woodland.jpg', alt: 'An open safari vehicle parked among acacia trees' },
  { file: 'diani-coast.jpg', alt: 'Sunny Kenyan Coast with some makeshift structures'},
  { file: 'maasai-mara.jpg', alt: 'Wildebeest grazing in the Maasai Mara Game reserve during migration'},
  { file: 'elephant-amboseli.jpg', alt: 'An elephant walking in Amboseli Park'}
] as const

const destinations = [
  { name: 'Maasai Mara', slug: 'maasai-mara', image: 5 },
  { name: 'Amboseli', slug: 'amboseli', image: 1 },
  { name: 'Tsavo', slug: 'tsavo', image: 3 },
  { name: 'Diani & the coast', slug: 'diani-coast', image: 4 },
] as const

type SeedPackage = {
  title: string
  slug: string
  durationDays: number
  priceFrom: number
  priceNote: string
  priceResident?: number
  offerLabel?: string
  summary: string
  destinations: string[]
  tags: string[]
  image: number
  isFeatured: boolean
  itinerary: { day: number; title: string; description: string }[]
  inclusions: string[]
  exclusions: string[]
}

const packages: SeedPackage[] = [
  {
    title: '3 Days in the Maasai Mara',
    slug: '3-days-maasai-mara',
    durationDays: 3,
    priceFrom: 58000,
    priceNote: 'per person sharing, non-resident, low season',
    priceResident: 34500,
    summary: 'Two full days of game drives from a tented camp inside the reserve, with the drive out from Nairobi on either end.',
    destinations: ['maasai-mara'],
    tags: ['safari', 'short break'],
    image: 0,
    isFeatured: true,
    itinerary: [
      { day: 1, title: 'Nairobi to the Mara', description: 'Leave Nairobi after breakfast, arrive at camp for lunch, then an afternoon game drive until the light goes.' },
      { day: 2, title: 'Full day in the reserve', description: 'Early drive for the cats, back for lunch and a rest, out again at four. Packed lunch instead if you want to stay out.' },
      { day: 3, title: 'Morning drive and back', description: 'A last drive on the way out, lunch on the road, into Nairobi by evening.' },
    ],
    inclusions: ['Park entry fees', 'Full board at camp', 'Transport in a 4x4 with a pop-up roof', 'Driver-guide', 'Drinking water'],
    exclusions: ['Flights', 'Balloon safari', 'Drinks at camp', 'Tips'],
  },
  {
    title: 'Amboseli Under Kilimanjaro',
    slug: 'amboseli-under-kilimanjaro',
    durationDays: 3,
    priceFrom: 52000,
    priceNote: 'per person sharing, non-resident, low season',
    priceResident: 31000,
    summary: 'Elephant herds against the mountain, and the clear early mornings when Kilimanjaro is actually out.',
    destinations: ['amboseli'],
    tags: ['safari', 'photography'],
    image: 6,
    isFeatured: true,
    itinerary: [
      { day: 1, title: 'Nairobi to Amboseli', description: 'Down through Emali, into the park by early afternoon, game drive before dinner.' },
      { day: 2, title: 'The full day', description: 'Out at first light for the mountain, then Observation Hill and the swamps in the afternoon.' },
      { day: 3, title: 'Last morning', description: 'Dawn drive while the mountain is clear, breakfast, then back to Nairobi.' },
    ],
    inclusions: ['Park entry fees', 'Full board at lodge', 'Transport in a 4x4', 'Driver-guide'],
    exclusions: ['Flights', 'Drinks', 'Tips', 'Maasai village visit'],
  },
  {
    title: 'Mara and Nakuru',
    slug: 'mara-and-nakuru',
    durationDays: 5,
    priceFrom: 96000,
    priceNote: 'per person sharing, non-resident, low season',
    priceResident: 61000,
    offerLabel: 'Low season',
    summary: 'The Mara for the plains game, Nakuru for rhino and flamingo, with the Rift Valley escarpment in between.',
    destinations: ['maasai-mara'],
    tags: ['safari', 'rift valley'],
    image: 3,
    isFeatured: true,
    itinerary: [
      { day: 1, title: 'Nairobi to Lake Nakuru', description: 'Down the escarpment with a stop at the viewpoint, afternoon drive in the park.' },
      { day: 2, title: 'Nakuru to the Mara', description: 'Morning drive for rhino, then across to the Mara through Narok.' },
      { day: 3, title: 'Full day in the Mara', description: 'Morning and afternoon drives, or one long day out with lunch packed.' },
      { day: 4, title: 'Mara River', description: 'Out towards the river and the Tanzanian border, back through the plains.' },
      { day: 5, title: 'Back to Nairobi', description: 'A morning drive, then the road home, arriving late afternoon.' },
    ],
    inclusions: ['All park entry fees', 'Full board throughout', '4x4 with pop-up roof', 'Driver-guide', 'Drinking water'],
    exclusions: ['Flights', 'Balloon safari', 'Drinks', 'Tips'],
  },
  {
    title: 'Tsavo East and West',
    slug: 'tsavo-east-and-west',
    durationDays: 4,
    priceFrom: 64000,
    priceNote: 'per person sharing, non-resident, low season',
    priceResident: 38000,
    summary: 'Red elephant, Mzima Springs and a lot of space. The quieter alternative when the Mara is full.',
    destinations: ['tsavo'],
    tags: ['safari', 'quiet'],
    image: 3,
    isFeatured: true,
    itinerary: [
      { day: 1, title: 'Nairobi to Tsavo East', description: 'The Mombasa road to Voi, into the park by mid-afternoon.' },
      { day: 2, title: 'Tsavo East', description: 'Aruba Dam and the Galana river, full day of drives.' },
      { day: 3, title: 'Across to Tsavo West', description: 'Through Chyulu Gate, Mzima Springs in the afternoon.' },
      { day: 4, title: 'Back to Nairobi', description: 'Morning drive, then the road back.' },
    ],
    inclusions: ['Park entry fees', 'Full board', '4x4 transport', 'Driver-guide'],
    exclusions: ['Flights', 'Drinks', 'Tips'],
  },
  {
    title: 'Mara and Diani',
    slug: 'mara-and-diani',
    durationDays: 8,
    priceFrom: 168000,
    priceNote: 'per person sharing, non-resident, low season, excluding the Nairobi–Diani flight',
    priceResident: 104000,
    summary: 'Four days of game drives, then four on the south coast. The usual honeymoon shape, and the usual family one.',
    destinations: ['maasai-mara', 'diani-coast'],
    tags: ['safari', 'beach', 'honeymoon', 'family'],
    image: 2,
    isFeatured: true,
    itinerary: [
      { day: 1, title: 'Nairobi to the Mara', description: 'Drive out, afternoon game drive.' },
      { day: 2, title: 'Full day in the reserve', description: 'Two drives, or one long one.' },
      { day: 3, title: 'Mara River', description: 'Towards the river and back across the plains.' },
      { day: 4, title: 'Mara to Nairobi, fly to Diani', description: 'Morning drive, road to Nairobi, evening flight to the coast.' },
      { day: 5, title: 'Diani', description: 'Nothing scheduled.' },
      { day: 6, title: 'Diani', description: 'Kisite marine park or Wasini island if you want it.' },
      { day: 7, title: 'Diani', description: 'Nothing scheduled.' },
      { day: 8, title: 'Home', description: 'Transfer to Ukunda for the flight back.' },
    ],
    inclusions: ['Park entry fees', 'Full board on safari', 'Bed and breakfast at the coast', '4x4 transport', 'Driver-guide', 'Airport transfers'],
    exclusions: ['Nairobi–Diani flight', 'Marine park fees', 'Drinks', 'Tips'],
  },
  {
    title: 'A Weekend in Nakuru',
    slug: 'weekend-in-nakuru',
    durationDays: 2,
    priceFrom: 24000,
    priceNote: 'per person sharing, resident rate, weekends only',
    summary: 'Leave Nairobi Saturday morning, back Sunday evening. Rhino, flamingo and the escarpment on the way down.',
    destinations: ['maasai-mara'],
    tags: ['safari', 'short break', 'family'],
    image: 1,
    isFeatured: false,
    itinerary: [
      { day: 1, title: 'Down the escarpment', description: 'Out of Nairobi by seven, into the park for an afternoon drive.' },
      { day: 2, title: 'Morning drive and home', description: 'Early drive for rhino, back in Nairobi by evening.' },
    ],
    inclusions: ['Park entry fees', 'One night full board', 'Transport', 'Driver-guide'],
    exclusions: ['Drinks', 'Tips'],
  },
]

const seed = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database. This content is synthetic.')
  }

  const payload = await getPayload({ config })

  payload.logger.info('Clearing existing synthetic content…')
  await payload.delete({ collection: 'packages', where: { id: { exists: true } } })
  await payload.delete({ collection: 'destinations', where: { id: { exists: true } } })
  await payload.delete({ collection: 'media', where: { id: { exists: true } } })

  payload.logger.info('Seeding synthetic development content…')

  const mediaIds: number[] = []
  for (const image of images) {
    const doc = await payload.create({
      collection: 'media',
      data: { alt: image.alt },
      filePath: path.join(imageDir, image.file),
    })
    mediaIds.push(doc.id)
  }

  const destinationIds = new Map<string, number>()
  for (const destination of destinations) {
    const doc = await payload.create({
      collection: 'destinations',
      data: {
        name: destination.name,
        slug: destination.slug,
        coverImage: mediaIds[destination.image],
      },
    })
    destinationIds.set(destination.slug, doc.id)
  }

  for (const pkg of packages) {
    await payload.create({
      collection: 'packages',
      data: {
        title: pkg.title,
        slug: pkg.slug,
        durationDays: pkg.durationDays,
        priceFrom: pkg.priceFrom,
        priceNote: pkg.priceNote,
        priceResident: pkg.priceResident,
        currency: 'KES',
        offerLabel: pkg.offerLabel,
        summary: pkg.summary,
        itinerary: pkg.itinerary,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        tags: pkg.tags,
        destinations: pkg.destinations.map((slug, index) => ({
          destination: destinationIds.get(slug)!,
          isPrimary: index === 0,
        })),
        images: [{ image: mediaIds[pkg.image], isCover: true }],
        isFeatured: pkg.isFeatured,
        isPublished: true,
      },
    })
  }

  payload.logger.info(
    `Seeded ${images.length} media, ${destinations.length} destinations, ${packages.length} packages. All synthetic — delete before launch.`,
  )
  process.exit(0)
}

await seed()
