import { connection } from "next/server"
import { experimental_upgradeWebSocket } from "@vercel/functions"

import {
  getSpeechEngine,
  getSpeechEngineServer,
} from "@/lib/server/speech-engine"
import {
  isVoiceModeEnabled,
  voiceModeDisabledResponse,
} from "@/lib/server/voice-mode"

const headersToRecord = (headers: Headers) => {
  const record: Record<string, string | string[] | undefined> = {}

  headers.forEach((value, key) => {
    record[key] = value
  })

  return record
}

export const GET = async (request: Request) => {
  if (!isVoiceModeEnabled()) {
    return voiceModeDisabledResponse()
  }

  await connection()

  const upgradeHeader = request.headers.get("upgrade")

  if (upgradeHeader?.toLowerCase() !== "websocket") {
    return Response.json(
      { error: "Expected WebSocket upgrade request" },
      { status: 426 }
    )
  }

  try {
    const engine = await getSpeechEngine()
    const isValid = await engine.verifyRequest({
      headers: headersToRecord(request.headers),
    })

    if (!isValid) {
      return new Response("Unauthorized", { status: 401 })
    }

    const server = getSpeechEngineServer()

    return experimental_upgradeWebSocket((ws) => {
      server.handleConnection(ws)
    })
  } catch (error) {
    console.error("[SpeechEngine] websocket upgrade failed", error)

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Speech Engine websocket failed",
      },
      { status: 500 }
    )
  }
}
