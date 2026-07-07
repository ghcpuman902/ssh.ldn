import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  description: SITE_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
  },
  featureList: [
    "London address geocoding",
    "Noise score from road, rail, aircraft, and local venues",
    "Weekday/weekend and day/night time profiles",
    "Plain-language noise explanations",
  ],
  slogan: SITE_TAGLINE,
}

export const SiteJsonLd = () => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
    }}
  />
)
