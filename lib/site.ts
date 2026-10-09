export const SITE_URL = "https://ssh-ldn.app"

export const SITE_NAME = "ssh-ldn"

export const SITE_SHORT_NAME = "ssh-ldn"

export const SITE_TAGLINE =
  "London Noise Map for renting, buying, and visiting."

export const SITE_DESCRIPTION =
  "Search a London address to compare road, rail, aircraft, pub, and club noise across weekday/weekend and day/night before you rent, buy, or visit."

export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

export const SITE_KEYWORDS = [
  "London noise map",
  "London noise score",
  "renting London noise",
  "road noise London",
  "rail noise London",
  "pub noise London",
  "weekday night noise London",
  "address noise checker",
]

export const SITE_GITHUB_URL = "https://github.com/ghcpuman902/ssh.ldn"

/** Bump when public copy or data changes so sitemap `lastmod` stays honest. */
export const SITE_CONTENT_UPDATED = "2026-10-09"

export const SITE_LOGO_PATH = "/icon"

/** Shared by the About page, its FAQPage JSON-LD, and llms-full.txt. */
export const SITE_FAQ = [
  {
    question: "What is ssh-ldn?",
    answer:
      "ssh-ldn is a free London noise map. Search a London address or postcode and it shows how loud the street is likely to be from roads, railways, aircraft, and nearby pubs, bars, clubs and music venues, for weekdays and weekends, by day and by night.",
  },
  {
    question: "How is the noise score calculated?",
    answer:
      "The 0–100 score combines the official DEFRA Round 4 strategic noise maps for road, rail and aircraft noise (2021 baseline, 10 m grid) with local noise sources from OpenStreetMap, such as pubs, bars, clubs and music venues. It is weighted for the chosen time slot and returned with a confidence band, the dominant sources, a weekday/weekend and day/evening/night profile, and recommended checks.",
  },
  {
    question: "Is the noise live or measured?",
    answer:
      "No. DEFRA strategic noise maps are modelled annual averages, not live measurements, and OpenStreetMap opening hours are partial, so venue activity at some times is estimated with heuristics. Treat the score as a prompt for what to check, then visit the address at the loudest time.",
  },
  {
    question: "Which times of day does it cover?",
    answer:
      "The map has a Day (07:00–19:00) and Night (23:00–07:00) view for weekdays and weekends. The address report also covers the evening (19:00–23:00) and highlights the loudest time slot for the address.",
  },
  {
    question: "Which places does ssh-ldn cover?",
    answer:
      "Greater London only. The data sources are the DEFRA noise mapping for London, OpenStreetMap, Transport for London station data, and the OpenFreeMap basemap.",
  },
  {
    question: "Can I use ssh-ldn from an AI assistant or in code?",
    answer:
      "Yes. There is a free, rate-limited, read-only REST endpoint at /api/noise-address and a public MCP server at /api/mcp/mcp with the explain_london_noise_for_address tool. See the API docs for examples.",
  },
] as const
