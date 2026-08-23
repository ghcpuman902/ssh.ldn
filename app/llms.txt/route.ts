import {
  SITE_DESCRIPTION,
  SITE_GITHUB_URL,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site"

const LLMS_TXT = `# ${SITE_NAME}

> ${SITE_TAGLINE} ${SITE_DESCRIPTION}

## Product

- [Home map](${SITE_URL}/): Search a London address and inspect road, rail, aircraft, pub, and club noise by weekday/weekend and day/night.
- [Data sources](${SITE_URL}/data-sources): Dataset attributions and licences.

## API

- [API docs](${SITE_URL}/api-docs): Human-readable guide to the address-to-noise service.
- [Noise address API](${SITE_URL}/api/noise-address): Public read-only endpoint. Example: \`${SITE_URL}/api/noise-address?address=5%20Euston%20Road%20London&timeSlot=weekday-night\`
- [MCP endpoint](${SITE_URL}/api/mcp/mcp): Public read-only Model Context Protocol server with the \`explain_london_noise_for_address\` tool.

## Optional

- [GitHub repository](${SITE_GITHUB_URL})
`

export const GET = () =>
  new Response(LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  })
