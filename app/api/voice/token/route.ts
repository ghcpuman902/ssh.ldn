import { type NextRequest } from "next/server"

import {
  issueVoiceConversationToken,
} from "@/lib/server/speech-engine"
import {
  storePendingVoiceContext,
} from "@/lib/server/voice-context-store"
import type { LocationContext } from "@/lib/voice/location-context"

type VoiceTokenRequest = {
  context?: LocationContext
}

const isLocationContext = (value: unknown): value is LocationContext => {
  if (!value || typeof value !== "object") {
    return false
  }

  const context = value as Partial<LocationContext>

  return (
    typeof context.address === "string" &&
    typeof context.normalizedAddress === "string" &&
    typeof context.latitude === "number" &&
    typeof context.longitude === "number" &&
    typeof context.coordinatePrecision === "string" &&
    Array.isArray(context.dominantSources) &&
    Array.isArray(context.warnings) &&
    typeof context.timeSlot === "object" &&
    context.timeSlot !== null &&
    typeof context.timeSlot.week === "string" &&
    typeof context.timeSlot.part === "string"
  )
}

export const POST = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as VoiceTokenRequest

    if (!isLocationContext(body.context)) {
      return Response.json(
        { error: "A valid location context is required" },
        { status: 400 }
      )
    }

    const contextSessionId = storePendingVoiceContext(body.context)
    const token = await issueVoiceConversationToken()

    return Response.json({
      token,
      contextSessionId,
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to issue voice conversation token",
      },
      { status: 502 }
    )
  }
}
