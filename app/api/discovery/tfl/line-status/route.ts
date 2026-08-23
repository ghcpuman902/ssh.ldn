import { type NextRequest } from "next/server"

import { getTflLineStatus } from "@/lib/server/tfl"

export const GET = async (request: NextRequest) => {
  const lineIdsParam = request.nextUrl.searchParams.get("lineIds")

  if (!lineIdsParam?.trim()) {
    return Response.json(
      { error: "lineIds query param is required (comma-separated)" },
      { status: 400 }
    )
  }

  const lineIds = lineIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)

  if (lineIds.length === 0) {
    return Response.json(
      { error: "lineIds must contain at least one line id" },
      { status: 400 }
    )
  }

  try {
    const data = await getTflLineStatus({ lineIds })
    return Response.json(data)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cached transit lookup failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
