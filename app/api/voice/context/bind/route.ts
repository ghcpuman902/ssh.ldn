import { type NextRequest } from "next/server"

import {
  getVoiceCorsHeaders,
  voiceOptionsResponse,
} from "@/lib/server/voice-cors"
import { bindVoiceContextToConversation } from "@/lib/server/voice-context-store"
import type { LocationContext } from "@/lib/voice/location-context"

type BindVoiceContextRequest = {
  contextSessionId?: string
  conversationId?: string
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

export const OPTIONS = async (request: NextRequest) =>
  voiceOptionsResponse(request)

export const POST = async (request: NextRequest) => {
  const headers = getVoiceCorsHeaders(request)

  try {
    const body = (await request.json()) as BindVoiceContextRequest
    const contextSessionId = body.contextSessionId?.trim()
    const conversationId = body.conversationId?.trim()
    const context = isLocationContext(body.context) ? body.context : undefined

    if (!contextSessionId || !conversationId) {
      return Response.json(
        { error: "contextSessionId and conversationId are required" },
        { status: 400, headers }
      )
    }

    const bound = bindVoiceContextToConversation(
      contextSessionId,
      conversationId,
      context
    )

    if (!bound) {
      return Response.json(
        { error: "Voice context session expired or not found" },
        { status: 404, headers }
      )
    }

    return Response.json({ ok: true }, { headers })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to bind voice context",
      },
      { status: 502, headers }
    )
  }
}
