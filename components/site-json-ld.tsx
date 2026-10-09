import { JsonLd } from "@/components/json-ld"
import {
  SITE_CONTENT_UPDATED,
  SITE_DESCRIPTION,
  SITE_GITHUB_URL,
  SITE_LOGO_PATH,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"

export const SITE_ORGANIZATION_ID = `${SITE_URL}/#organization`
export const SITE_WEBSITE_ID = `${SITE_URL}/#website`
export const SITE_APP_ID = `${SITE_URL}/#app`

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE_ORGANIZATION_ID,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}${SITE_LOGO_PATH}`,
      sameAs: [SITE_GITHUB_URL],
    },
    {
      "@type": "WebSite",
      "@id": SITE_WEBSITE_ID,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en-GB",
      publisher: { "@id": SITE_ORGANIZATION_ID },
    },
    {
      "@type": "WebApplication",
      "@id": SITE_APP_ID,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      slogan: SITE_TAGLINE,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires a modern browser with WebGL.",
      inLanguage: "en-GB",
      isAccessibleForFree: true,
      dateModified: SITE_CONTENT_UPDATED,
      areaServed: { "@type": "AdministrativeArea", name: "Greater London" },
      audience: {
        "@type": "Audience",
        audienceType: "People renting, buying or visiting in London",
      },
      isPartOf: { "@id": SITE_WEBSITE_ID },
      publisher: { "@id": SITE_ORGANIZATION_ID },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
      },
      featureList: [
        "London address and postcode search",
        "Noise score from road, rail, aircraft, and local venues",
        "Weekday/weekend and day/night time profiles",
        "Plain-language noise explanations",
        "Public read-only REST API and MCP server",
      ],
      softwareHelp: { "@type": "WebPage", url: `${SITE_URL}/about` },
    },
  ],
}

export const SiteJsonLd = () => <JsonLd data={jsonLd} />
