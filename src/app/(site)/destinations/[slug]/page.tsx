import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CtaBanner } from "@/components/cta-banner";
import { PackageCard } from "@/components/package-card";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  asMedia,
  getDestinationBySlug,
  getPackagesForDestination,
} from "@/lib/content";
import { canonical } from "@/lib/seo";

export const revalidate = 300;

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) return {};

  return {
    title: destination.seo?.title || destination.name,
    description:
      destination.seo?.description ||
      `Safari packages and trip ideas for ${destination.name}.`,
    ...canonical(`/destinations/${destination.slug}`),
  };
}

export default async function DestinationDetailPage({ params }: RouteProps) {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();

  const [packages] = await Promise.all([getPackagesForDestination(destination.slug, 18)]);
  const cover = asMedia(destination.coverImage);

  return (
    <>
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <Breadcrumbs items={[{ label: "Destinations", href: "/destinations" }, { label: destination.name }]} />

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-display">{destination.name}</h1>

          {cover?.url && (
            <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
              <Image
                src={cover.url}
                alt={cover.alt}
                fill
                priority
                sizes="(min-width: 1024px) 62vw, 92vw"
                className="object-cover"
              />
            </div>
          )}

          {destination.overview && (
            <div className="measure mt-6 flex flex-col gap-4 text-foreground [&_ul]:list-disc [&_ul]:pl-5">
              <RichText data={destination.overview} />
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-xl border border-border p-6">
            <p className="font-heading text-heading">Planning this destination?</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Message us with your dates and budget range and we will suggest the
              best-fit itinerary.
            </p>
            <WhatsAppCta
              context={destination.name}
              label="Ask about this destination"
              className="mt-6 w-full"
            />
          </div>
        </aside>
      </div>

      <section className="mt-14 border-t border-border pt-10">
        <h2 className="text-title">Packages in {destination.name}</h2>

        {packages.length > 0 ? (
          <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="font-heading text-heading">No packages published yet</p>
            <p className="measure mx-auto mt-2 text-muted-foreground">
              We can still plan this trip for you. Tell us your dates and preferred
              pace, and we will propose options.
            </p>
            <div className="mt-6 flex justify-center">
              <WhatsAppCta context={destination.name} label="Plan this trip" />
            </div>
          </div>
        )}
      </section>
    </main>

    <CtaBanner
      title={`Still deciding on ${destination.name}?`}
      description="Tell a consultant your dates and budget on WhatsApp and we'll put together an itinerary that fits."
      whatsappContext={destination.name}
      secondaryHref="/destinations"
      secondaryLabel="Browse more destinations"
    />
    </>
  );
}
