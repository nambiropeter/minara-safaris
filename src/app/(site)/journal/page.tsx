import type { Metadata } from "next";

import { FeaturedJournalStory, JournalCard } from "@/components/journal-card";
import { getPublishedArticles } from "@/lib/content";
import { canonical } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Journal",
  description: "Practical safari planning guides, destination ideas, and trip notes.",
  ...canonical("/journal"),
};

export default async function JournalPage() {
  const articles = await getPublishedArticles();
  const featuredArticles = articles.filter((a) => Boolean(a.isFeatured));
  const standardArticles = articles.filter((a) => !a.isFeatured);

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
        <div className="mt-12">
          {/* Single Featured Lead Story */}
          {featuredArticles.length === 1 && (
            <section aria-label="Featured article">
              <FeaturedJournalStory article={featuredArticles[0]} />
            </section>
          )}

          {/* Multiple Featured Articles Grid */}
          {featuredArticles.length > 1 && (
            <section aria-label="Featured articles">
              <div className="mb-8 flex items-baseline justify-between">
                <h2 className="font-heading text-title">Featured Guides</h2>
                <span className="text-sm text-muted-foreground">
                  {featuredArticles.length} featured
                </span>
              </div>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
                {featuredArticles.map((article) => (
                  <FeaturedJournalStory key={article.id} article={article} compact />
                ))}
              </div>
            </section>
          )}

          {/* Standard / All Other Articles */}
          {standardArticles.length > 0 && (
            <section
              aria-label="All articles"
              className={featuredArticles.length > 0 ? "mt-16 border-t border-border pt-12" : "mt-2"}
            >
              {featuredArticles.length > 0 && (
                <div className="mb-8 flex items-baseline justify-between">
                  <h2 className="font-heading text-title">All Guides &amp; Notes</h2>
                  <span className="text-sm text-muted-foreground">
                    {standardArticles.length} {standardArticles.length === 1 ? "article" : "articles"}
                  </span>
                </div>
              )}

              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {standardArticles.map((article, index) => (
                  <JournalCard
                    key={article.id}
                    article={article}
                    priority={index < 3}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
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
