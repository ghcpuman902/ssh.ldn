import { type NextRequest } from "next/server"

import { bindVoiceContextToConversation } from "@/lib/server/voice-context-store"

type BindVoiceContextRequest = {
  contextSessionId?: string
  conversationId?: string
}

export const POST = async (request: NextRequest) => {
  try {
    const body = (await request.json()) as BindVoiceContextRequest
    const contextSessionId = body.contextSessionId?.trim()
    const conversationId = body.conversationId?.trim()

    if (!contextSessionId || !conversationId) {
      return Response.json(
        { error: "contextSessionId and conversationId are required" },
        { status: 400 }
      )
    }

    const bound = bindVoiceContextToConversation(
      contextSessionId,
      conversationId
    )

    if (!bound) {
      return Response.json(
        { error: "Voice context session expired or not found" },
        { status: 404 }
      )
    }

    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to bind voice context",
      },
      { status: 502 }
    )
  }
}
