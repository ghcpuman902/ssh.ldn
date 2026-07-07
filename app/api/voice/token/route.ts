import { type NextRequest } from "next/server"

import { enforceBotProtection } from "@/lib/server/bot-protection"
import { enforceRateLimit } from "@/lib/server/rate-limit"
import { issueVoiceConversationToken } from "@/lib/server/speech-engine"
import {
  getVoiceCorsHeaders,
  voiceOptionsResponse,
} from "@/lib/server/voice-cors"
import {
  isVoiceModeEnabled,
  voiceModeDisabledResponse,
} from "@/lib/server/voice-mode"
import { storePendingVoiceContext } from "@/lib/server/voice-context-store"
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

export const OPTIONS = async (request: NextRequest) =>
  voiceOptionsResponse(request)

export const POST = async (request: NextRequest) => {
  const headers = getVoiceCorsHeaders(request)

  if (!isVoiceModeEnabled()) {
    return voiceModeDisabledResponse(headers)
  }

  const rateLimited = await enforceRateLimit(request, {
    routeName: "voice-token",
    limit: 5,
    windowSeconds: 3_600,
  })

  if (rateLimited) {
    return new Response(rateLimited.body, {
      status: rateLimited.status,
      headers: {
        ...Object.fromEntries(rateLimited.headers.entries()),
        ...headers,
      },
    })
  }

  const botBlocked = await enforceBotProtection()

  if (botBlocked) {
    return new Response(botBlocked.body, {
      status: botBlocked.status,
      headers: {
        ...Object.fromEntries(botBlocked.headers.entries()),
        ...headers,
      },
    })
  }

  try {
    const body = (await request.json()) as VoiceTokenRequest

    if (!isLocationContext(body.context)) {
      return Response.json(
        { error: "A valid location context is required" },
        { status: 400, headers }
      )
    }

    const contextSessionId = storePendingVoiceContext(body.context)
    const token = await issueVoiceConversationToken()

    return Response.json(
      {
        token,
        contextSessionId,
      },
      { headers }
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to issue voice conversation token",
      },
      { status: 502, headers }
    )
  }
}
