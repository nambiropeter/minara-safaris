import type { Metadata } from "next";
import Image from "next/image";

import { CtaBanner } from "@/components/cta-banner";
import { DestinationAccordion } from "@/components/destination-accordion";
import { getDestinations } from "@/lib/content";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About",
  description:
    "Minara Safaris connects travelers to custom wildlife and coastal routes across Kenya and East Africa, with direct consultant planning and transparent pricing.",
  ...canonical("/about"),
};

export default async function AboutPage() {
  const destinations = await getDestinations(4);

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-14">
        {/* Hero: Centered Editorial Statement with Inline Photo Pills */}
        <section
          aria-label="About Minara Safaris"
          className="mx-auto max-w-4xl text-center pt-2 pb-10 sm:pt-6 sm:pb-16"
        >
          <h1 className="font-heading text-4xl leading-[1.2] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-[3.75rem]">
            We believe planning a safari
            <span
              aria-hidden="true"
              className="relative mx-2 inline-flex h-[1.15em] w-[2.8em] align-[-0.12em] overflow-hidden rounded-full border border-border shadow-xs sm:mx-2.5 sm:w-[3.4em]"
            >
              <Image
                src="/images/maasai-mara.jpg"
                alt=""
                fill
                sizes="160px"
                className="object-cover object-center"
              />
            </span>
            begins with honest conversation, published prices, and genuine local guidance
            <span
              aria-hidden="true"
              className="relative mx-2 inline-flex h-[1.15em] w-[2.8em] align-[-0.12em] overflow-hidden rounded-full border border-border shadow-xs sm:mx-2.5 sm:w-[3.4em]"
            >
              <Image
                src="/images/diani-coast.jpg"
                alt=""
                fill
                sizes="160px"
                className="object-cover object-center"
              />
            </span>
            .
          </h1>

          <p className="measure mx-auto mt-8 text-lead leading-relaxed text-muted-foreground sm:text-xl md:text-2xl">
            Minara Safaris plans fixed and custom wildlife itineraries.
            We don’t sell anything you can’t ask a direct question about first.
          </p>
        </section>

        {/* Interactive Expanding 4-Destination Cards (Dynamic from Payload CMS) */}
        {destinations.length > 0 && (
          <section aria-label="Featured circuits" className="mt-8 sm:mt-12">
            <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
              <div>
                <h2 className="font-heading text-title">Core Circuits</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Our primary safari and coastal destinations across East Africa.
                </p>
              </div>
              <span className="text-label text-muted-foreground">
                Hover to expand destination
              </span>
            </div>

            <DestinationAccordion destinations={destinations} />
          </section>
        )}

        {/* Section: Three Commitments */}
        <section
          aria-label="Our commitments"
          className="mt-20 border-t border-border pt-16 sm:mt-28 sm:pt-20"
        >
          <div className="max-w-2xl">
            <h2 className="font-heading text-title">How We Operate</h2>
            <p className="measure mt-2 text-lead text-muted-foreground">
              A travel desk built around clarity, direct communication, and genuine local knowledge.
            </p>
          </div>

          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col">
              <span className="font-heading text-2xl font-medium text-primary">01</span>
              <h3 className="mt-3 font-heading text-xl font-medium text-foreground">
                Direct Human Planning
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                When you message us on WhatsApp, you speak directly with the consultant who builds
                your route. No automated phone trees, no ticket queues — just real answers from
                someone who knows the driving times, lodge conditions, and migration seasons firsthand.
              </p>
            </div>

            <div className="flex flex-col">
              <span className="font-heading text-2xl font-medium text-primary">02</span>
              <h3 className="mt-3 font-heading text-xl font-medium text-foreground">
                Dual Rate Transparency
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Every itinerary and package clearly lists its conditions, inclusions, and resident rates
                where they apply. We believe pricing is the foundation of trust, not a hook to hide
                park fees or unexpected add-ons down the line.
              </p>
            </div>

            <div className="flex flex-col">
              <span className="font-heading text-2xl font-medium text-primary">03</span>
              <h3 className="mt-3 font-heading text-xl font-medium text-foreground">
                Custom Routes &amp; Vetted Partners
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We work with experienced 4x4 driver-guides, tented bush camps, and established lodges
                across Kenya and Tanzania. Every trip is adjusted around your dates, budget, and travel style.
              </p>
            </div>
          </div>
        </section>

        {/* Section: How Planning Works (High-Craft Editorial Rule-Over-Content Sequence) */}
        <section
          aria-label="Planning process"
          className="mt-20 border-t border-border pt-16 sm:mt-28 sm:pt-20"
        >
          <div className="max-w-2xl">
            <h2 className="font-heading text-title">How Planning Actually Goes</h2>
            <p className="measure mt-2 text-lead text-muted-foreground">
              A sequence of three straightforward milestones from your first question to heading out.
            </p>
          </div>

          <div className="mt-12 divide-y divide-border border-y border-border">
            {/* Step 1 */}
            <div className="grid gap-6 py-8 sm:grid-cols-12 sm:items-baseline sm:py-10">
              <div className="sm:col-span-2">
                <span className="font-heading text-4xl font-medium text-primary/80 tabular-nums sm:text-5xl">
                  01
                </span>
              </div>
              <div className="sm:col-span-4">
                <h3 className="font-heading text-2xl font-medium text-foreground">
                  The Initial Conversation
                </h3>
              </div>
              <div className="sm:col-span-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Message our team on WhatsApp with your preferred dates, party size, and wish list.
                  You speak directly with the planner who builds the itinerary — someone who knows
                  the road conditions, lodge availability, and seasonal wildlife movements.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid gap-6 py-8 sm:grid-cols-12 sm:items-baseline sm:py-10">
              <div className="sm:col-span-2">
                <span className="font-heading text-4xl font-medium text-primary/80 tabular-nums sm:text-5xl">
                  02
                </span>
              </div>
              <div className="sm:col-span-4">
                <h3 className="font-heading text-2xl font-medium text-foreground">
                  The Route &amp; Inclusions
                </h3>
              </div>
              <div className="sm:col-span-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  We draft a day-by-day proposal tailored to your pace and budget. Park entry fees,
                  4x4 transport with a pop-up roof, and full board accommodation are stated upfront
                  with dual resident and non-resident rates.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid gap-6 py-8 sm:grid-cols-12 sm:items-baseline sm:py-10">
              <div className="sm:col-span-2">
                <span className="font-heading text-4xl font-medium text-primary/80 tabular-nums sm:text-5xl">
                  03
                </span>
              </div>
              <div className="sm:col-span-4">
                <h3 className="font-heading text-2xl font-medium text-foreground">
                  Confirmation &amp; Safari
                </h3>
              </div>
              <div className="sm:col-span-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Lock in your lodges, receive pre-trip logistics notes, and head out. You have direct
                  WhatsApp contact with your planner throughout the safari for real-time questions
                  from touchdown to departure.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Conversion Banner */}
      <CtaBanner
        title="Ready to discuss your route?"
        description="Message our Nairobi planning team on WhatsApp with your rough dates and group size."
        whatsappContext="About page inquiry"
        secondaryHref="/packages"
        secondaryLabel="Explore fixed packages"
      />
    </>
  );
}
