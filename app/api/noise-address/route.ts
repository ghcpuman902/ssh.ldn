import { type NextRequest } from "next/server"
import { z } from "zod"

import {
  buildAddressNoiseReport,
  formatAddressNoiseReportText,
} from "@/lib/server/address-noise-report"
import { enforceRateLimit } from "@/lib/server/rate-limit"

const timeSlotSchema = z.enum([
  "weekday-day",
  "weekday-night",
  "weekend-day",
  "weekend-night",
])

const requestSchema = z.object({
  address: z.string().trim().min(1),
  floor: z.coerce.number().finite().optional(),
  facing: z.string().trim().optional(),
  timeSlot: timeSlotSchema.optional(),
})

const parseRequestInput = (request: NextRequest) => {
  const address = request.nextUrl.searchParams.get("address") ?? undefined
  const floor = request.nextUrl.searchParams.get("floor") ?? undefined
  const facing = request.nextUrl.searchParams.get("facing") ?? undefined
  const timeSlot = request.nextUrl.searchParams.get("timeSlot") ?? undefined

  if (address) {
    return requestSchema.parse({
      address,
      floor,
      facing,
      timeSlot,
    })
  }

  return null
}

const handleReportRequest = async (input: z.infer<typeof requestSchema>) => {
  const report = await buildAddressNoiseReport(input)

  if ("error" in report) {
    return Response.json({ error: report.error }, { status: report.status })
  }

  return Response.json(report)
}

export const GET = async (request: NextRequest) => {
  const rateLimited = await enforceRateLimit(request, {
    routeName: "noise-address",
    limit: 20,
    windowSeconds: 60,
  })

  if (rateLimited) {
    return rateLimited
  }

  try {
    const input = parseRequestInput(request)

    if (!input) {
      return Response.json(
        { error: "address query parameter is required" },
        { status: 400 }
      )
    }

    return handleReportRequest(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request parameters", details: error.flatten() },
        { status: 400 }
      )
    }

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Noise report request failed",
      },
      { status: 500 }
    )
  }
}

export const POST = async (request: NextRequest) => {
  const rateLimited = await enforceRateLimit(request, {
    routeName: "noise-address",
    limit: 20,
    windowSeconds: 60,
  })

  if (rateLimited) {
    return rateLimited
  }

  try {
    const body = await request.json()
    const input = requestSchema.parse(body)

    return handleReportRequest(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      )
    }

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Noise report request failed",
      },
      { status: 500 }
    )
  }
}