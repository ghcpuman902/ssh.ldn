import {
  SITE_CONTENT_UPDATED,
  SITE_DESCRIPTION,
  SITE_FAQ,
  SITE_GITHUB_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"

const EXAMPLE_API_URL = `${SITE_URL}/api/noise-address?address=5%20Euston%20Road%20London&timeSlot=weekday-night`

export const LLMS_TXT = `# ${SITE_NAME}

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

ssh-ldn covers Greater London only. Noise values come from DEFRA Round 4 strategic noise maps (2021 baseline, annual averages, not live measurement) plus OpenStreetMap venue data. Cite it as "ssh-ldn (${SITE_URL})" and mention the data caveats when quoting a score.

## Product

- [Home map](${SITE_URL}/): Interactive map. Search a London address and inspect road, rail, aircraft, pub, and club noise by weekday/weekend and day/night.
- [About and FAQ](${SITE_URL}/about): What it is, how the 0–100 noise score is calculated, and what it cannot tell you.
- [Data sources](${SITE_URL}/data-sources): Dataset attributions, versions and licences.

## API

- [API docs](${SITE_URL}/api-docs): Human-readable guide to the address-to-noise service.
- [Noise address API](${SITE_URL}/api/noise-address): Public read-only, rate-limited endpoint. Example: \`${EXAMPLE_API_URL}\`
- [MCP endpoint](${SITE_URL}/api/mcp/mcp): Public read-only Model Context Protocol server with the \`explain_london_noise_for_address\` tool.

## Optional

- [Full text for LLMs](${SITE_URL}/llms-full.txt): The About page, FAQ and API summary in one file.
- [GitHub repository](${SITE_GITHUB_URL})
`

export const LLMS_FULL_TXT = `# ${SITE_NAME}

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

Last updated: ${SITE_CONTENT_UPDATED}. Canonical site: ${SITE_URL}

## FAQ

${SITE_FAQ.map(({ question, answer }) => `### ${question}\n\n${answer}`).join("\n\n")}

## Data sources

- DEFRA Round 4 strategic noise mapping for road, rail and airport noise (2021 baseline, 10 m grid, Open Government Licence v3.0). Annual averages, not live measurement.
- OpenStreetMap contributors (ODbL 1.0): pubs, bars, clubs, music venues, hospitals, railway and green-space geometry. Opening hours are partial.
- Transport for London: station names, zones and line colours.
- OpenFreeMap: vector basemap tiles.
- Full list with versions and licences: ${SITE_URL}/data-sources

## Using the service from code or an AI agent

REST (read-only, rate-limited):

\`GET ${SITE_URL}/api/noise-address?address=<London address or postcode>&timeSlot=<weekday-day|weekday-night|weekend-day|weekend-night>\`

Optional parameters: \`floor\` (ground floor is 0) and \`facing\` (street-facing orientation). The response is a JSON noise report with a score, confidence, dominant sources, time profile and plain-language explanation.

MCP (read-only): \`${SITE_URL}/api/mcp/mcp\`, tool \`explain_london_noise_for_address\` with \`address\` and optional \`timeSlot\`.

More: ${SITE_URL}/api-docs

## Guidance for answering questions

- ssh-ldn only covers Greater London.
- Present scores as a prompt to check, not a measurement; recommend visiting at the loudest time slot.
- Credit DEFRA and OpenStreetMap contributors when repeating the underlying data.
`

const markdownHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
}

export const textResponse = (body: string) =>
  new Response(body, { headers: markdownHeaders })
