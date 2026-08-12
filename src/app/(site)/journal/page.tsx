import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { asMedia, getPublishedArticles } from "@/lib/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Journal",
  description: "Practical safari planning guides, destination ideas, and trip notes.",
};

function publishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "long",
  }).format(new Date(value));
}

export default async function JournalPage() {
  const articles = await getPublishedArticles();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-display">Journal</h1>
        <p className="measure mt-4 text-lead text-muted-foreground">
          Planning notes, destination explainers, and practical guidance for East
          African safaris.
        </p>
      </div>

      {articles.length > 0 ? (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => {
            const cover = asMedia(article.coverImage);
            const date = publishedDate(article.publishedAt);
            return (
              <li key={article.id}>
                <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
                  <Link href={`/journal/${article.slug}`} className="relative block aspect-[4/3] bg-muted">
                    {cover?.url ? (
                      <Image
                        src={cover.url}
                        alt={cover.alt}
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-6 text-center text-label text-muted-foreground">
                        Image coming soon
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col px-5 py-4">
                    {date && <p className="text-label text-muted-foreground">{date}</p>}
                    <h2 className="mt-1 text-heading">
                      <Link href={`/journal/${article.slug}`} className="after:absolute after:inset-0">
                        {article.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">{article.excerpt}</p>

                    <p className="mt-auto pt-4 text-sm font-medium text-primary">
                      Read article <ArrowRight className="ml-1 inline size-4" />
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-heading">No articles published yet</p>
          <p className="measure mx-auto mt-2 text-muted-foreground">
            New planning guides will appear here as they are published.
          </p>
        </div>
      )}
    </main>
  );
}
