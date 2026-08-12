import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { PackageCard } from "@/components/package-card";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import { Button } from "@/components/ui/button";
import {
  asMedia,
  getDestinations,
  getFeaturedPackages,
  getOfferPackages,
} from "@/lib/content";

export const revalidate = 300;

export default async function HomePage() {
  const [featured, offers, destinations] = await Promise.all([
    getFeaturedPackages(6),
    getOfferPackages(4),
    getDestinations(8),
  ]);

  return (
    <main>
      <Hero />
      {offers.length > 0 && <Offers packages={offers} />}
      <Featured packages={featured} />
      {destinations.length > 0 && <Destinations destinations={destinations} />}
      <HowItWorks />
      <Close />
    </main>
  );
}

/**
 * The dev photography is four portrait frames and one unusable landscape, so the
 * hero is composed around a 2:3 crop rather than a cinematic band — on phones the
 * image leads and the headline sits beneath it, on desktop it bleeds off the right.
 */
function Hero() {
  const moodboardItems = [
    {
      src: "/images/bush-camp-tent.jpg",
      alt: "Luxury bush camp tent nestled in wild foliage",
      location: "Luxury Bush Camp",
      className: "top-[4%] left-[2%] w-[42%] h-[44%] z-0 -rotate-6 shadow-md hover:-rotate-2",
    },
    {
      src: "/images/diani-coast.jpg",
      alt: "Sunny Kenyan coast with palm trees and ocean views",
      location: "Diani Beach",
      className: "top-[2%] right-[2%] w-[44%] h-[48%] z-10 rotate-4 shadow-lg hover:rotate-1",
    },
    {
      src: "/images/elephant-amboseli.jpg",
      alt: "An elephant walking in Amboseli Park",
      location: "Amboseli",
      className: "bottom-[2%] left-[4%] w-[45%] h-[46%] z-10 -rotate-3 shadow-lg hover:rotate-0",
    },
    {
      src: "/images/zebra-herd-savanna.jpg",
      alt: "A herd of zebra crossing dry golden grassland",
      location: "Savanna Plains",
      className: "bottom-[4%] right-[2%] w-[43%] h-[45%] z-0 rotate-6 shadow-md hover:rotate-2",
    },
    {
      src: "/images/cheetah-mara-game-drive.jpg",
      alt: "A cheetah sits in long grass while safari vehicles wait on the horizon",
      location: "Maasai Mara",
      className: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[54%] h-[72%] z-20 shadow-2xl hover:rotate-0",
      priority: true,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-8 pb-16 sm:px-8 sm:pt-14 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-16 lg:pb-24">
      <div className="lg:col-span-5">
        <h1 className="text-display">
          Safaris across Kenya and East Africa.
        </h1>
        <p className="measure mt-6 text-lead text-muted-foreground">
          Browse the trips we book most, then message the consultant who&rsquo;ll
          plan yours. Every package shows what the price includes and what it
          doesn&rsquo;t, with resident rates alongside.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button render={<Link href="/packages" />} size="cta">
            Browse packages
            <ArrowRight />
          </Button>
          <WhatsAppCta label="Ask a question" />
        </div>
      </div>

      <div className="relative mt-12 h-[440px] sm:h-[500px] lg:col-span-7 lg:mt-0 lg:h-[560px]">
        {moodboardItems.map((item, i) => (
          <div
            key={i}
            className={`group absolute overflow-hidden rounded-2xl border border-white/20 bg-muted transition-all duration-500 ease-out hover:z-30 hover:scale-105 hover:shadow-2xl ${item.className}`}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              priority={item.priority}
              sizes="(min-width: 1024px) 35vw, 90vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-75 transition-opacity group-hover:opacity-90" />
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md transition-colors group-hover:bg-black/70 sm:bottom-3 sm:left-3">
              {item.location}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  children,
  href,
  linkLabel,
}: {
  title: string;
  children?: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-title">{title}</h2>
        {children && (
          <p className="measure mt-3 text-muted-foreground">{children}</p>
        )}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          {linkLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/** Renders only when a package actually carries an offer — usually none do. */
function Offers({ packages }: { packages: Awaited<ReturnType<typeof getOfferPackages>> }) {
  return (
    <section className="border-y border-border bg-secondary/50 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading title="On offer now">
          Reduced for a limited window. The price note still applies — ask us what
          the dates look like before you plan around one.
        </SectionHeading>
        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Featured({ packages }: { packages: Awaited<ReturnType<typeof getFeaturedPackages>> }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading
        title="Trips we book most"
        href={packages.length > 0 ? "/packages" : undefined}
        linkLabel="All packages"
      >
        Fixed itineraries with published prices.
      </SectionHeading>

      {packages.length > 0 ? (
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-heading">No packages published yet</p>
          <p className="measure mx-auto mt-2 text-muted-foreground">
            Trips are being written up now. Message us in the meantime and
            we&rsquo;ll put something together from scratch.
          </p>
          <div className="mt-6 flex justify-center">
            <WhatsAppCta label="Tell us what you want" />
          </div>
        </div>
      )}
    </section>
  );
}

function Destinations({
  destinations,
}: {
  destinations: Awaited<ReturnType<typeof getDestinations>>;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 sm:pb-24">
      <SectionHeading title="Where people go">
        Parks, coast and the countries next door. Combination trips across
        borders are ordinary here, not an upgrade.
      </SectionHeading>

      <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {destinations.map((destination) => {
          const cover = asMedia(destination.coverImage);
          return (
            <li key={destination.id} className="group relative">
              <Link
                href={`/destinations/${destination.slug}`}
                className="block overflow-hidden rounded-xl"
              >
                <div className="relative aspect-[3/4] bg-muted">
                  {cover?.url && (
                    <Image
                      src={cover.url}
                      alt={cover.alt}
                      fill
                      sizes="(min-width: 1024px) 22vw, 45vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <p className="absolute inset-x-0 bottom-0 p-4 font-heading text-heading text-white">
                    {destination.name}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Proof of the mechanism rather than a claim about it — and the numbers are
 * earned here, because the sequence is the information.
 */
function HowItWorks() {
  const steps = [
    {
      title: "Find something close",
      body: "Filter by park, length or budget. Prices are what we quote, not a hook — the note next to each one tells you the season and what sharing basis it assumes.",
    },
    {
      title: "Message the consultant",
      body: "WhatsApp from the package page and the trip name comes with you. The person who replies is the person who builds your itinerary.",
    },
    {
      title: "Get a real itinerary back",
      body: "Dates checked, park fees confirmed, resident rates applied where they apply. Change anything before you commit to it.",
    },
  ];

  return (
    <section className="border-t border-border bg-secondary/40 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <h2 className="text-title">How booking actually goes</h2>
        <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((step, index) => (
            <li key={step.title} className="border-t-2 border-primary pt-5">
              <p className="text-label tabular-nums text-primary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-heading">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Close() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="relative overflow-hidden rounded-2xl">
        <Image
          src="/images/zebra-impala-hills.jpg"
          alt="Zebra and impala grazing with misty hills behind"
          fill
          sizes="(min-width: 1024px) 72rem, 92vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative px-6 py-16 text-center sm:px-16 sm:py-24">
          <h2 className="mx-auto max-w-2xl text-balance font-heading text-title text-white">
            Tell us the dates and who&rsquo;s travelling. We&rsquo;ll come back
            with what it actually costs.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <WhatsAppCta />
            <Button render={<Link href="/contact" />} variant="outline" size="cta">
              Send an enquiry
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
