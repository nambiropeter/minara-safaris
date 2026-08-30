import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { CtaBanner } from "@/components/cta-banner";
import { Clock } from "@/components/icons";
import { JournalCard } from "@/components/journal-card";
import { Badge } from "@/components/ui/badge";
import { asMedia, getArticleBySlug, getPublishedArticles } from "@/lib/content";
import { canonical } from "@/lib/seo";

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

export async function generateStaticParams() {
  const articles = await getPublishedArticles(50);
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: article.seo?.title || article.title,
    description: article.seo?.description || article.excerpt,
    ...canonical(`/journal/${article.slug}`),
  };
}

export default async function ArticlePage({ params }: RouteProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const [allArticles] = await Promise.all([getPublishedArticles(4)]);
  const relatedArticles = allArticles.filter((other) => other.id !== article.id).slice(0, 3);

  const cover = asMedia(article.coverImage);
  const date = publishedDate(article.publishedAt);
  const primaryTag = article.tags?.[0];
  const readTime = article.readTimeMinutes;

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        {/* Navigation Breadcrumbs */}
        <Breadcrumbs items={[{ label: "Journal", href: "/journal" }, { label: article.title }]} />

        {/* Editorial Header */}
        <header className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
            {primaryTag && (
              <Badge variant="secondary" className="font-medium">
                {primaryTag}
              </Badge>
            )}
            {date && <span>{date}</span>}
            {readTime ? (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {readTime} min read
                </span>
              </>
            ) : null}
          </div>

          <h1 className="mt-4 font-heading text-display leading-[1.08] tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {article.title}
          </h1>

          <p className="mt-6 text-lead leading-relaxed text-muted-foreground sm:text-xl">
            {article.excerpt}
          </p>
        </header>

        {/* Cover Photo */}
        {cover?.url && (
          <figure className="mt-10">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted sm:aspect-[16/10]">
              <Image
                src={cover.url}
                alt={cover.alt || article.title}
                fill
                priority
                sizes="(min-width: 1024px) 80vw, 92vw"
                className="object-cover"
              />
            </div>
            {cover.alt && cover.alt !== article.title && (
              <figcaption className="mt-3 text-center text-label text-muted-foreground italic">
                {cover.alt}
              </figcaption>
            )}
          </figure>
        )}

        {/* Article Body Content */}
        <article className="mx-auto mt-12 max-w-3xl">
          <div className="flex flex-col gap-6 font-sans text-[17px] leading-[1.8] text-foreground/90 sm:text-[18px] [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:text-foreground [&_h2]:sm:text-3xl [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:font-heading [&_h3]:text-xl [&_h3]:text-foreground [&_h3]:sm:text-2xl [&_h3]:mt-10 [&_h3]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-6 [&_blockquote]:my-8 [&_blockquote]:italic [&_blockquote]:font-heading [&_blockquote]:text-xl [&_blockquote]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ul>li]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ol>li]:mb-2 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-foreground">
            <RichText data={article.body} />
          </div>
        </article>

        {/* Related Articles Section */}
        {relatedArticles.length > 0 && (
          <section aria-label="Related articles" className="mt-20 border-t border-border pt-14">
            <div className="mb-8 flex items-baseline justify-between">
              <div>
                <h2 className="font-heading text-title">More from the Journal</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Practical safari planning notes and destination explainers.
                </p>
              </div>
              <Link
                href="/journal"
                className="link-underline text-sm font-medium text-primary hover:text-foreground"
              >
                View all
              </Link>
            </div>

            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((related) => (
                <JournalCard key={related.id} article={related} />
              ))}
            </div>
          </section>
        )}
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
