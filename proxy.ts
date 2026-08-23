import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { isSameOriginRequest } from "@/lib/server/same-origin"

/**
 * Everything under /api/ is UI plumbing (map tiles, geometry, OSM cells,
 * scoring) meant only for this site's own pages, except the handful of
 * routes deliberately advertised as a public/AI-facing contract in
 * app/llms.txt/route.ts. Voice has its own CORS handling in
 * lib/server/voice-cors.ts (it needs to allow a configurable embed origin,
 * not just same-origin), so it's exempted here too.
 */
const PUBLIC_API_PREFIXES = ["/api/noise-address", "/api/mcp", "/api/voice"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/api/:path*",
}
