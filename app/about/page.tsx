import type { Metadata } from "next"
import Link from "next/link"

import { JsonLd } from "@/components/json-ld"
import { SITE_APP_ID } from "@/components/site-json-ld"
import {
  SITE_CONTENT_UPDATED,
  SITE_DESCRIPTION,
  SITE_FAQ,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"

const TITLE = "About and FAQ"
const DESCRIPTION =
  "What ssh-ldn is, how its London noise score is calculated, which data it uses, and what the numbers can and cannot tell you before you rent, buy or visit."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `${TITLE} — ${SITE_NAME}`,
    description: DESCRIPTION,
    url: `${SITE_URL}/about`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — ${SITE_NAME}`,
    description: DESCRIPTION,
  },
}

const pageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about#page`,
      url: `${SITE_URL}/about`,
      name: `${TITLE} — ${SITE_NAME}`,
      description: DESCRIPTION,
      inLanguage: "en-GB",
      dateModified: SITE_CONTENT_UPDATED,
      about: { "@id": SITE_APP_ID },
      breadcrumb: { "@id": `${SITE_URL}/about#breadcrumb` },
      mainEntity: { "@id": `${SITE_URL}/about#faq` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/about#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: TITLE,
          item: `${SITE_URL}/about`,
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/about#faq`,
      mainEntity: SITE_FAQ.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
}

const STEPS = [
  {
    title: "Search an address",
    body: "Type a London address or postcode, or tap the map. The address is geocoded and placed on the noise map.",
  },
  {
    title: "Read the score",
    body: "You get a 0–100 noise score with a confidence band, the sources that dominate (road, rail, aircraft, local venues) and a profile for weekdays and weekends, by day, evening and night.",
  },
  {
    title: "Check it in person",
    body: "The report lists recommended checks, such as visiting at the loudest time slot, so the number prompts the right questions rather than replacing a viewing.",
  },
] as const

export default function AboutPage() {
  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8 md:py-12">
      <JsonLd data={pageJsonLd} />
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <Link
            href="/"
            className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Back to map
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              About {SITE_NAME}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              {SITE_TAGLINE} {SITE_DESCRIPTION}
            </p>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            How it works
          </h2>
          <ol className="space-y-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-xl border border-border p-4"
              >
                <h3 className="font-medium text-foreground">
                  {index + 1}. {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Frequently asked questions
          </h2>
          <div className="space-y-5">
            {SITE_FAQ.map(({ question, answer }) => (
              <div key={question}>
                <h3 className="font-medium text-foreground">{question}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            More detail
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <Link
                href="/data-sources"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Data sources and licences
              </Link>
            </li>
            <li>
              <Link
                href="/api-docs"
                className="underline underline-offset-2 hover:text-foreground"
              >
                API and MCP docs
              </Link>
            </li>
            <li>
              <a
                href="/llms.txt"
                className="underline underline-offset-2 hover:text-foreground"
              >
                llms.txt for AI agents
              </a>
            </li>
          </ul>
          <p className="pt-2 text-xs text-muted-foreground">
            Last updated {SITE_CONTENT_UPDATED}.
          </p>
        </section>
      </div>
    </main>
  )
}
