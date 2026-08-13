import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CtaBanner } from "@/components/cta-banner";
import { Check, MapPin, X } from "@/components/icons";
import { ImageLightbox } from "@/components/image-lightbox";
import { PackageCard } from "@/components/package-card";
import { PriceBlock } from "@/components/price-block";
import { WhatsAppCta } from "@/components/whatsapp-cta";
import {
  asMedia,
  destinationNames,
  getPackageBySlug,
  getPublishedPackages,
  getRelatedPackages,
} from "@/lib/content";

export const revalidate = 300;

export async function generateStaticParams() {
  const packages = await getPublishedPackages();
  return packages.map((pkg) => ({ slug: pkg.slug }));
}

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) return {};

  return {
    title: pkg.seo?.title || pkg.title,
    description: pkg.seo?.description || pkg.summary,
  };
}

export default async function PackageDetailPage({ params }: RouteProps) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) notFound();

  const places = destinationNames(pkg);
  const images = (pkg.images ?? []).map((entry) => asMedia(entry.image)).filter((media) => media !== null);
  const related = await getRelatedPackages(pkg);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: pkg.title,
    description: pkg.summary,
    touristType: pkg.tags,
    offers: {
      "@type": "Offer",
      price: pkg.priceFrom,
      priceCurrency: pkg.currency ?? "KES",
    },
  };

  return (
    <>
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumbs items={[{ label: "Packages", href: "/packages" }, { label: pkg.title }]} />

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-display">{pkg.title}</h1>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {places.length > 0 && (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {places.join(" · ")}
              </li>
            )}
            <li>
              {pkg.durationDays} {pkg.durationDays === 1 ? "day" : "days"}
            </li>
          </ul>

          {images.length > 0 && (
            <ImageLightbox
              images={images.map((image) => ({ id: image.id, url: image.url ?? "", alt: image.alt }))}
            />
          )}

          <p className="measure mt-6 text-lead text-muted-foreground">{pkg.summary}</p>

          {pkg.description && (
            <div className="measure mt-6 flex flex-col gap-4 text-foreground [&_ul]:list-disc [&_ul]:pl-5">
              <RichText data={pkg.description} />
            </div>
          )}

          {(pkg.itinerary?.length ?? 0) > 0 && (
            <section className="mt-10">
              <h2 className="text-title">Itinerary</h2>
              <ol className="mt-4 flex flex-col gap-6 border-l border-border pl-6">
                {pkg.itinerary!.map((day) => (
                  <li key={day.id ?? day.day} className="relative">
                    <span className="absolute -left-[calc(1.5rem+1px)] flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground tabular-nums">
                      {day.day}
                    </span>
                    <h3 className="font-heading text-heading">{day.title}</h3>
                    {day.description && <p className="mt-1 text-muted-foreground">{day.description}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {((pkg.inclusions?.length ?? 0) > 0 || (pkg.exclusions?.length ?? 0) > 0) && (
            <section className="mt-10 grid gap-8 sm:grid-cols-2">
              {(pkg.inclusions?.length ?? 0) > 0 && (
                <div>
                  <h2 className="text-title">Included</h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {pkg.inclusions!.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(pkg.exclusions?.length ?? 0) > 0 && (
                <div>
                  <h2 className="text-title">Not included</h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {pkg.exclusions!.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <X className="mt-0.5 size-4 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-xl border border-border p-6">
            <PriceBlock pkg={pkg} size="detail" />
            <WhatsAppCta context={pkg.title} slug={pkg.slug} className="mt-6 w-full" />
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="text-title">You might also like</h2>
          <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((relatedPkg) => (
              <PackageCard key={relatedPkg.id} pkg={relatedPkg} />
            ))}
          </div>
        </section>
      )}
    </main>

    <CtaBanner
      title="Ready to plan this trip?"
      description="Send the dates and party size to a consultant on WhatsApp — no forms, no accounts, just a straight answer on availability and price."
      whatsappContext={pkg.title}
      secondaryHref="/packages"
      secondaryLabel="Browse more packages"
    />
    </>
  );
}
