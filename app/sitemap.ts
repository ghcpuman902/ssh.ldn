import type { MetadataRoute } from "next"

import { SITE_CONTENT_UPDATED, SITE_URL } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE_CONTENT_UPDATED)

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/api-docs`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/data-sources`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]
}
