import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getPublicPageBySlug,
  getPublicPages,
  type PublicPageSlug,
} from "@/lib/content";

export const revalidate = 300;

const STATIC_PAGE_SLUGS: PublicPageSlug[] = [
  "about",
  "contact",
  "faqs",
  "terms",
  "privacy",
];

function isPublicPageSlug(slug: string): slug is PublicPageSlug {
  return STATIC_PAGE_SLUGS.includes(slug as PublicPageSlug);
}

export async function generateStaticParams() {
  const pages = await getPublicPages();
  return pages.map((page) => ({ slug: page.slug }));
}

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isPublicPageSlug(slug)) return {};

  const page = await getPublicPageBySlug(slug);
  if (!page) return {};

  return {
    title: page.seo?.title || page.title,
    description: page.seo?.description,
  };
}

export default async function StaticPage({ params }: RouteProps) {
  const { slug } = await params;
  if (!isPublicPageSlug(slug)) notFound();

  const page = await getPublicPageBySlug(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="text-display">{page.title}</h1>
      <article className="measure mt-8 flex flex-col gap-4 text-foreground [&_h2]:font-heading [&_h2]:text-heading [&_h3]:font-heading [&_h3]:text-heading [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
        <RichText data={page.body} />
      </article>
    </main>
  );
}
