import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { ElevenLabsClient, SpeechEngineServer } from "@elevenlabs/elevenlabs-js"
import type {
  SpeechEngineCallbacks,
  TranscriptMessage,
} from "@elevenlabs/elevenlabs-js/wrapper/speech-engine"
import { generateText, streamText } from "ai"

import {
  buildRateLimitKey,
  checkRateLimit,
} from "@/lib/server/rate-limit"
import {
  buildLocationContextPrompt,
  enrichLocationContext,
  type LocationContext,
} from "@/lib/voice/location-context"
import {
  clearVoiceContextForConversation,
  getVoiceContextForConversation,
} from "@/lib/server/voice-context-store"

const DEFAULT_VOICE_MODEL = "openai/gpt-5-mini"
const MAX_VOICE_OUTPUT_TOKENS = 500
const MAX_VOICE_TURNS_PER_CONVERSATION = 30
const VOICE_CONVERSATION_WINDOW_SECONDS = 3_600

const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  includeUsage: true,
  headers: {
    "HTTP-Referer":
      process.env.OPENROUTER_SITE_URL ?? "https://ssh-ldn.app",
    "X-Title": "ssh-ldn",
  },
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
    speechEngineResourcePromise =
      getElevenLabsClient().speechEngine.get(engineId)
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

const buildVoiceAnswerParams = (
  question: string,
  context: LocationContext | null,
  signal: AbortSignal
) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured")
  }

  const system = context
    ? buildLocationContextPrompt(enrichLocationContext(context))
    : [
        "You are ssh-ldn, a concise London noise analyst.",
        "The user has not bound a location yet.",
        "Ask them to search for and analyse an address before asking location-specific questions.",
        "Keep spoken answers to one short sentence.",
      ].join("\n")
  const modelId = process.env.OPENROUTER_MODEL ?? DEFAULT_VOICE_MODEL

  return {
    model: openrouter.chatModel(modelId),
    system,
    prompt: question,
    abortSignal: signal,
    temperature: 0.2,
    maxOutputTokens: MAX_VOICE_OUTPUT_TOKENS,
    providerOptions: {
      openrouter: {
        reasoning: { effort: "minimal" },
      },
    },
  }
}

export const generateAnswer = (
  question: string,
  context: LocationContext | null,
  signal: AbortSignal
) => streamText(buildVoiceAnswerParams(question, context, signal))

async function* streamVoiceAnswer(
  question: string,
  context: LocationContext | null,
  signal: AbortSignal
) {
  try {
    const params = buildVoiceAnswerParams(question, context, signal)
    const result = streamText(params)
    let streamedAny = false

    for await (const chunk of result.textStream) {
      if (!chunk) {
        continue
      }

      streamedAny = true
      yield chunk
    }

    if (streamedAny) {
      return
    }

    const streamedText = (await result.text).trim()

    if (streamedText) {
      yield streamedText
      return
    }

    const fallback = await generateText(params)
    const fallbackText = fallback.text.trim()

    if (fallbackText) {
      yield fallbackText
      return
    }

    yield "I could not generate an answer for that question."
  } catch (error) {
    console.error("[SpeechEngine] failed to generate answer", {
      message: error instanceof Error ? error.message : "Unknown error",
    })

    yield "I could not answer by voice right now. Press Escape to return to your screen reader."
  }
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
    const enrichedContext = context ? enrichLocationContext(context) : null

    const turnLimit = await checkRateLimit({
      key: buildRateLimitKey("voice-openrouter-turns", conversationId),
      limit: MAX_VOICE_TURNS_PER_CONVERSATION,
      windowSeconds: VOICE_CONVERSATION_WINDOW_SECONDS,
    })

    if (!turnLimit.allowed) {
      await session.sendResponse(
        "This conversation has reached its limit. Please restart voice mode."
      )
      return
    }

    await session.sendResponse(
      streamVoiceAnswer(question, enrichedContext, signal)
    )
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
