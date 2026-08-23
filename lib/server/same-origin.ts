/**
 * Distinguishes "this site's own pages calling their own map/tile plumbing"
 * from cross-origin hotlinking, scrapers, and scripted clients hitting the
 * same URL directly. Not a security boundary — headers are spoofable by any
 * client that sets them on purpose — but it filters out the large share of
 * bots and other sites that just replay URLs without mimicking a browser.
 *
 * Deliberately public endpoints (advertised in /llms.txt for AI agents/MCP
 * clients) must not be gated by this — see the exemption list in proxy.ts.
 */

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"

/** Fetch Metadata header sent by Chromium, Firefox, and Safari 16.4+ on nearly every request. */
const isAllowedSecFetchSite = (value: string) =>
  value === "same-origin" || value === "same-site" || value === "none"

export const isSameOriginRequest = (request: Request): boolean => {
  const secFetchSite = request.headers.get("sec-fetch-site")
  if (secFetchSite) {
    return isAllowedSecFetchSite(secFetchSite)
  }

  // No Fetch Metadata support (older Safari, non-browser client) — fall back
  // to Origin/Referer against the request's own Host header.
  const candidate =
    request.headers.get("origin") ?? request.headers.get("referer")
  if (!candidate) {
    return false
  }

  try {
    const candidateUrl = new URL(candidate)
    if (isLoopbackHost(candidateUrl.hostname)) {
      return true
    }

    const requestHost = request.headers.get("host")
    return requestHost !== null && candidateUrl.host === requestHost
  } catch {
    return false
  }
}
