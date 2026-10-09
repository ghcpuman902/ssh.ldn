import type { MetadataRoute } from "next"

import { SITE_URL } from "@/lib/site"

const ALLOW = ["/", "/og", "/llms.txt", "/llms-full.txt", "/api/noise-address", "/api/mcp"]
const DISALLOW = ["/api/", "/dev/"]

// Answer-engine and user-triggered fetchers are named so the intent is
// explicit; training crawlers fall under `*` and are allowed too.
const AI_SEARCH_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "Applebot",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      { userAgent: AI_SEARCH_AGENTS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
