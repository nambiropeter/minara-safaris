import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CtaBanner } from "@/components/cta-banner";
import { asMedia, getArticleBySlug } from "@/lib/content";

export const revalidate = 300;

function publishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "long",
  }).format(new Date(value));
}

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: article.seo?.title || article.title,
    description: article.seo?.description || article.excerpt,
  };
}

export default async function ArticlePage({ params }: RouteProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const cover = asMedia(article.coverImage);
  const date = publishedDate(article.publishedAt);

  return (
    <>
    <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <Breadcrumbs items={[{ label: "Journal", href: "/journal" }, { label: article.title }]} />

      {date && <p className="text-label text-muted-foreground">{date}</p>}
      <h1 className="mt-2 text-display">{article.title}</h1>
      <p className="measure mt-4 text-lead text-muted-foreground">{article.excerpt}</p>

      {cover?.url && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl bg-muted">
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            priority
            sizes="(min-width: 1024px) 68vw, 92vw"
            className="object-cover"
          />
        </div>
      )}

      <article className="measure mt-8 flex flex-col gap-4 text-foreground [&_h2]:font-heading [&_h2]:text-heading [&_h3]:font-heading [&_h3]:text-heading [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
        <RichText data={article.body} />
      </article>
    </main>

    <CtaBanner
      title="Ready to turn this into a trip?"
      description="Send a consultant your dates on WhatsApp and we'll help you plan it."
      whatsappContext={article.title}
      secondaryHref="/journal"
      secondaryLabel="More from the journal"
    />
    </>
  );
}
