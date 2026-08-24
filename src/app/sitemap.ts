import type { MetadataRoute } from "next";

import {
  getAllDestinations,
  getPublicPages,
  getPublishedArticles,
  getPublishedPackages,
} from "@/lib/content";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [packages, destinations, articles, pages] = await Promise.all([
    getPublishedPackages(),
    getAllDestinations(),
    getPublishedArticles(),
    getPublicPages(),
  ]);

  const staticRoutes = ["", "/packages", "/destinations", "/journal", "/contact"].map((path) => ({
    url: `${site.url}${path}`,
  }));

  return [
    ...staticRoutes,
    ...pages.map((page) => ({ url: `${site.url}/${page.slug}` })),
    ...packages.map((pkg) => ({ url: `${site.url}/packages/${pkg.slug}` })),
    ...destinations.map((d) => ({ url: `${site.url}/destinations/${d.slug}` })),
    ...articles.map((article) => ({ url: `${site.url}/journal/${article.slug}` })),
  ];
}
