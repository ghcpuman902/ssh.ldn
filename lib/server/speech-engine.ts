import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { ElevenLabsClient, SpeechEngineServer } from "@elevenlabs/elevenlabs-js"
import type {
  SpeechEngineCallbacks,
  TranscriptMessage,
} from "@elevenlabs/elevenlabs-js/wrapper/speech-engine"
import { streamText } from "ai"

import {
  buildLocationContextPrompt,
  type LocationContext,
} from "@/lib/voice/location-context"
import {
  clearVoiceContextForConversation,
  getVoiceContextForConversation,
} from "@/lib/server/voice-context-store"

const DEFAULT_VOICE_MODEL = "gemini-2.5-flash"

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

let elevenLabsClient: ElevenLabsClient | null = null
let speechEngineResourcePromise: ReturnType<
  ElevenLabsClient["speechEngine"]["get"]
> | null = null
let speechEngineServer: SpeechEngineServer | null = null

const getElevenLabsClient = () => {
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured")
  }

  if (!elevenLabsClient) {
    elevenLabsClient = new ElevenLabsClient({ apiKey })
  }

  return elevenLabsClient
}

export const getSpeechEngine = async () => {
  const engineId = process.env.ELEVENLABS_SPEECH_ENGINE_ID

  if (!engineId) {
    throw new Error("ELEVENLABS_SPEECH_ENGINE_ID is not configured")
  }

  if (!speechEngineResourcePromise) {
    speechEngineResourcePromise = getElevenLabsClient().speechEngine.get(engineId)
  }

  return speechEngineResourcePromise
}

const extractLatestUserQuestion = (transcript: TranscriptMessage[]) => {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const message = transcript[index]

    if (message.role === "user" && message.content.trim().length > 0) {
      return message.content.trim()
    }
  }

  return null
}

export const generateAnswer = (
  question: string,
  context: LocationContext | null,
  signal: AbortSignal
) => {
  const system = context
    ? buildLocationContextPrompt(context)
    : [
        "You are ssh.ldn, a concise London noise analyst.",
        "The user has not bound a location yet.",
        "Ask them to search for and analyse an address before asking location-specific questions.",
        "Keep spoken answers short.",
      ].join("\n")

  return streamText({
    model: google(DEFAULT_VOICE_MODEL),
    system,
    prompt: question,
    abortSignal: signal,
  })
}

const createSpeechEngineCallbacks = (): SpeechEngineCallbacks => ({
  debug: process.env.NODE_ENV !== "production",
  onInit: (conversationId) => {
    console.info("[SpeechEngine] session initialized", { conversationId })
  },
  onTranscript: async (transcript, signal, session) => {
    const conversationId = session.conversationId

    if (!conversationId) {
      await session.sendResponse(
        "I could not identify this conversation yet. Please try again."
      )
      return
    }

    const question = extractLatestUserQuestion(transcript)

    if (!question) {
      await session.sendResponse(
        "I did not catch a question. What would you like to know about this location?"
      )
      return
    }

    const context = getVoiceContextForConversation(conversationId)
    const result = generateAnswer(question, context, signal)

    await session.sendResponse(result.textStream)
  },
  onClose: (session) => {
    if (session.conversationId) {
      clearVoiceContextForConversation(session.conversationId)
    }

    console.info("[SpeechEngine] session closed", {
      conversationId: session.conversationId,
    })
  },
  onDisconnect: (session) => {
    if (session.conversationId) {
      clearVoiceContextForConversation(session.conversationId)
    }

    console.warn("[SpeechEngine] session disconnected", {
      conversationId: session.conversationId,
    })
  },
  onError: (error, session) => {
    console.error("[SpeechEngine] session error", {
      conversationId: session.conversationId,
      message: error.message,
    })
  },
})

export const getSpeechEngineServer = () => {
  if (!speechEngineServer) {
    speechEngineServer = new SpeechEngineServer({
      apiKey: process.env.ELEVENLABS_API_KEY,
      ...createSpeechEngineCallbacks(),
    })
  }

  return speechEngineServer
}

export const issueVoiceConversationToken = async () => {
  const engineId = process.env.ELEVENLABS_SPEECH_ENGINE_ID

  if (!engineId) {
    throw new Error("ELEVENLABS_SPEECH_ENGINE_ID is not configured")
  }

  const response =
    await getElevenLabsClient().conversationalAi.conversations.getWebrtcToken({
      agentId: engineId,
    })

  return response.token
}
