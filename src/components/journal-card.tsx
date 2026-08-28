import Image from "next/image";
import Link from "next/link";

import { ArrowRight, Clock } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { asMedia } from "@/lib/content";
import type { Article } from "@/payload-types";

function publishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
  }).format(new Date(value));
}

/**
 * Modern unenclosed editorial card atom for the journal.
 * Matches `PackageCard` and `DestinationCard` in sitting freely on the page
 * without box wrappers, borders, or card background tints.
 */
export function JournalCard({
  article,
  priority = false,
}: {
  article: Article;
  priority?: boolean;
}) {
  const cover = asMedia(article.coverImage);
  const date = publishedDate(article.publishedAt);
  const primaryTag = article.tags?.[0];
  const readTime = article.readTimeMinutes;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
        {cover?.url ? (
          <Image
            src={cover.url}
            alt={cover.alt || article.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-label text-muted-foreground">
            Image coming soon
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col">
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

        <h3 className="mt-2 font-heading text-xl font-medium leading-snug text-foreground transition-colors duration-200 group-hover:text-primary sm:text-2xl">
          <Link href={`/journal/${article.slug}`} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {article.excerpt}
        </p>

        <div className="mt-auto pt-4">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            Read article
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * Grand featured lead story component for the top of the Journal index.
 */
export function FeaturedJournalStory({
  article,
  compact = false,
}: {
  article: Article;
  compact?: boolean;
}) {
  const cover = asMedia(article.coverImage);
  const date = publishedDate(article.publishedAt);
  const primaryTag = article.tags?.[0];
  const readTime = article.readTimeMinutes;

  if (compact) {
    return (
      <article className="group relative flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
          {cover?.url ? (
            <Image
              src={cover.url}
              alt={cover.alt || article.title}
              fill
              sizes="(min-width: 1024px) 45vw, 92vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
              Image coming soon
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
            <Badge variant="secondary" className="font-medium">
              {primaryTag || "Featured Guide"}
            </Badge>
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

          <h3 className="mt-2.5 font-heading text-2xl font-medium leading-snug text-foreground transition-colors duration-200 group-hover:text-primary sm:text-3xl">
            <Link href={`/journal/${article.slug}`} className="after:absolute after:inset-0">
              {article.title}
            </Link>
          </h3>

          <p className="mt-2.5 line-clamp-3 text-lead leading-relaxed text-muted-foreground">
            {article.excerpt}
          </p>

          <div className="mt-auto pt-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              Read guide
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative grid gap-6 lg:grid-cols-12 lg:items-center lg:gap-10">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted lg:col-span-7">
        {cover?.url ? (
          <Image
            src={cover.url}
            alt={cover.alt || article.title}
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 92vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
            Image coming soon
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center lg:col-span-5">
        <div className="flex flex-wrap items-center gap-2 text-label text-muted-foreground">
          <Badge variant="secondary" className="font-medium">
            {primaryTag || "Featured Guide"}
          </Badge>
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

        <h2 className="mt-3 font-heading text-title leading-[1.15] text-foreground transition-colors duration-200 group-hover:text-primary sm:text-3xl lg:text-4xl">
          <Link href={`/journal/${article.slug}`} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h2>

        <p className="mt-3 line-clamp-4 text-lead leading-relaxed text-muted-foreground">
          {article.excerpt}
        </p>

        <div className="mt-6">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            Read full guide
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}
