import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: process.env.NEXT_PUBLIC_SITE_URL ? "/" : undefined,
      disallow: process.env.NEXT_PUBLIC_SITE_URL ? "/admin" : "/",
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
