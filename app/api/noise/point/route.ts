import { getNoiseGrid, handleNoisePointRequest } from "@/lib/server/noise-grid"
import { enforceRateLimit } from "@/lib/server/rate-limit"

const rateLimit = (request: Request) =>
  enforceRateLimit(request, {
    routeName: "noise-point",
    limit: 60,
    windowSeconds: 60,
  })

export const GET = async (request: Request) =>
  (await rateLimit(request)) ?? handleNoisePointRequest(request, getNoiseGrid())

export const POST = async (request: Request) =>
  (await rateLimit(request)) ?? handleNoisePointRequest(request, getNoiseGrid())
