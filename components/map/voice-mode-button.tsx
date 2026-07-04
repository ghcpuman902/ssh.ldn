"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ConversationProvider, useConversation } from "@elevenlabs/react"
import { Loader2, Mic, MicOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildVoiceFirstMessage,
  toDynamicVariables,
  type LocationContext,
} from "@/lib/voice/location-context"
import { voiceApiUrl } from "@/lib/voice/voice-api"
import { cn } from "@/lib/utils"

type VoiceModeButtonProps = {
  context: LocationContext | null
  className?: string
}

type VoiceSessionState = "idle" | "connecting" | "active" | "error"

const readVoiceError = async (response: Response, fallback: string) => {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error ?? fallback
  } catch {
    return fallback
  }
}

const formatVoiceStartError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "Failed to start voice mode. Return to your screen reader and try again."
  }

  if (error.message === "Failed to fetch") {
    return "Voice mode could not reach the voice service. Return to your screen reader and try again."
  }

  return error.message
}

const bindVoiceContext = async (
  contextSessionId: string,
  conversationId: string,
  context: LocationContext
) => {
  const response = await fetch(voiceApiUrl("/api/voice/context/bind"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contextSessionId,
      conversationId,
      context,
    }),
  })

  if (!response.ok) {
    throw new Error(
      await readVoiceError(response, "Failed to bind voice context")
    )
  }
}

const VoiceModeButtonInner = ({ context, className }: VoiceModeButtonProps) => {
  const [sessionState, setSessionState] = useState<VoiceSessionState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const contextSessionIdRef = useRef<string | null>(null)
  const contextRef = useRef<LocationContext | null>(null)
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(
    null
  )
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const conversation = useConversation({
    onConnect: () => {
      setSessionState("active")
      setErrorMessage(null)

      const conversationId = conversationRef.current?.getId()
      const contextSessionId = contextSessionIdRef.current
      const activeContext = contextRef.current

      if (!conversationId || !contextSessionId || !activeContext) {
        return
      }

      void bindVoiceContext(
        contextSessionId,
        conversationId,
        activeContext
      ).catch((error) => {
        console.error("[VoiceMode] failed to bind context", error)
      })
    },
    onDisconnect: () => {
      setSessionState("idle")
      contextSessionIdRef.current = null
      contextRef.current = null
    },
    onError: (message) => {
      setSessionState("error")
      setErrorMessage(message || "Voice mode failed")
    },
  })

  conversationRef.current = conversation

  const isDisabled = !context || sessionState === "connecting"
  const isActive = sessionState === "active"

  const statusLabel = useMemo(() => {
    if (!context) {
      return "Search and analyse an address to enable voice mode"
    }

    if (sessionState === "connecting") {
      return "Connecting voice mode"
    }

    if (sessionState === "error") {
      return errorMessage ?? "Voice mode error"
    }

    if (isActive) {
      if (conversation.isSpeaking) {
        return "Voice mode speaking. Press Escape to stop and return to your screen reader."
      }

      if (conversation.isListening) {
        return "Voice mode listening. Press Escape to stop and return to your screen reader."
      }

      return "Voice mode active. Press Escape to stop and return to your screen reader."
    }

    if (process.env.NODE_ENV === "development") {
      return "Start voice mode. In development, voice routes use the deployed server."
    }

    return "Start voice mode to ask about this location"
  }, [
    context,
    conversation.isListening,
    conversation.isSpeaking,
    errorMessage,
    isActive,
    sessionState,
  ])

  const handleStartSession = useCallback(async () => {
    if (!context) {
      return
    }

    setSessionState("connecting")
    setErrorMessage(null)

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })

      const response = await fetch(voiceApiUrl("/api/voice/token"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context }),
      })

      if (!response.ok) {
        throw new Error(
          await readVoiceError(response, "Failed to start voice mode")
        )
      }

      const data = (await response.json()) as {
        token?: string
        contextSessionId?: string
        error?: string
      }

      if (!data.token || !data.contextSessionId) {
        throw new Error(data.error ?? "Failed to start voice mode")
      }

      contextSessionIdRef.current = data.contextSessionId
      contextRef.current = context

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
        dynamicVariables: toDynamicVariables(context, data.contextSessionId),
        overrides: {
          agent: {
            firstMessage: buildVoiceFirstMessage(context),
          },
        },
      })
    } catch (error) {
      contextSessionIdRef.current = null
      contextRef.current = null
      setSessionState("error")
      setErrorMessage(formatVoiceStartError(error))
      buttonRef.current?.focus()
    }
  }, [context, conversation])

  const handleStopSession = useCallback(() => {
    conversation.endSession()
    contextSessionIdRef.current = null
    contextRef.current = null
    setSessionState("idle")
    setErrorMessage(null)
    buttonRef.current?.focus()
  }, [conversation])

  const handleToggle = useCallback(() => {
    if (isActive) {
      handleStopSession()
      return
    }

    void handleStartSession()
  }, [handleStartSession, handleStopSession, isActive])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape" && isActive) {
        event.preventDefault()
        handleStopSession()
        return
      }

      if (event.key !== "Enter" && event.key !== " ") {
        return
      }

      event.preventDefault()
      handleToggle()
    },
    [handleStopSession, handleToggle, isActive]
  )

  useEffect(() => {
    if (!isActive) {
      return
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }

      event.preventDefault()
      handleStopSession()
    }

    document.addEventListener("keydown", handleDocumentKeyDown)

    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown)
    }
  }, [handleStopSession, isActive])

  return (
    <div
      className={cn(
        "space-y-2 rounded-2xl border border-border/60 bg-white p-3",
        className
      )}
    >
      <Button
        ref={buttonRef}
        type="button"
        variant={isActive ? "default" : "outline"}
        size="sm"
        aria-label={
          isActive
            ? "Stop voice mode for this location"
            : "Start voice mode for this location"
        }
        aria-pressed={isActive}
        aria-describedby="voice-mode-status"
        aria-busy={sessionState === "connecting"}
        aria-keyshortcuts="Enter Space Escape"
        disabled={isDisabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="h-11 w-full justify-start gap-2 rounded-2xl border-border/60 text-sm"
      >
        {sessionState === "connecting" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isActive ? (
          <MicOff className="size-4" aria-hidden="true" />
        ) : (
          <Mic className="size-4" aria-hidden="true" />
        )}
        <span>{isActive ? "Stop voice mode" : "Ask with voice"}</span>
      </Button>

      <p
        id="voice-mode-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "px-1 text-xs",
          sessionState === "error"
            ? "text-destructive"
            : "text-muted-foreground"
        )}
      >
        {statusLabel}
      </p>
    </div>
  )
}

export const VoiceModeButton = (props: VoiceModeButtonProps) => (
  <ConversationProvider>
    <VoiceModeButtonInner {...props} />
  </ConversationProvider>
)
