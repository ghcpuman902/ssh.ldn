import Link from "next/link"

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"

export const metadata = {
  title: `API docs — ${SITE_NAME}`,
  description:
    "Public read-only API and MCP tools for turning a London address into a noise score and explanation.",
}

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
    <code>{children}</code>
  </pre>
)

export default function ApiDocsPage() {
  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8 md:py-12">
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
              API docs
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              {SITE_TAGLINE} {SITE_DESCRIPTION}
            </p>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Address to noise report
          </h2>
          <p className="text-sm text-muted-foreground">
            The primary service is address-first: geocode a London address, then
            return a noise score, confidence band, dominant sources, time
            profile, and plain-language explanation. This is designed for
            renting, buying, and visiting decisions rather than map rendering.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">REST API</h2>
          <p className="text-sm text-muted-foreground">
            Public read-only endpoint with rate limiting.
          </p>
          <CodeBlock>{`GET ${SITE_URL}/api/noise-address?address=5 Euston Road London&timeSlot=weekday-night

POST ${SITE_URL}/api/noise-address
Content-Type: application/json

{
  "address": "5 Euston Road London",
  "floor": 2,
  "facing": "street",
  "timeSlot": "weekday-night"
}`}</CodeBlock>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">address</span>{" "}
              required. London address or postcode.
            </p>
            <p>
              <span className="font-medium text-foreground">floor</span>{" "}
              optional. Ground floor is 0.
            </p>
            <p>
              <span className="font-medium text-foreground">facing</span>{" "}
              optional. Street-facing orientation if known.
            </p>
            <p>
              <span className="font-medium text-foreground">timeSlot</span>{" "}
              optional. One of{" "}
              <code>weekday-day</code>, <code>weekday-night</code>,{" "}
              <code>weekend-day</code>, or <code>weekend-night</code>.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">MCP server</h2>
          <p className="text-sm text-muted-foreground">
            For ChatGPT, Claude, and other MCP clients, connect to the public
            read-only MCP endpoint and call the{" "}
            <code>explain_london_noise_for_address</code> tool.
          </p>
          <CodeBlock>{`MCP URL: ${SITE_URL}/api/mcp/mcp

Tool: explain_london_noise_for_address
Input:
{
  "address": "5 Euston Road London",
  "timeSlot": "weekday-night"
}`}</CodeBlock>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            AI discovery
          </h2>
          <p className="text-sm text-muted-foreground">
            Machine-readable index for agents and LLM crawlers:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <a
                href="/llms.txt"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                /llms.txt
              </a>
            </li>
            <li>
              <a
                href="/data-sources"
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                /data-sources
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
