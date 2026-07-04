"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react"
import { Loader2, Mic, MicOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  buildVoiceFirstMessage,
  toDynamicVariables,
  type LocationContext,
} from "@/lib/voice/location-context"
import { cn } from "@/lib/utils"

type VoiceModeButtonProps = {
  context: LocationContext | null
  className?: string
}

type VoiceSessionState = "idle" | "connecting" | "active" | "error"

const bindVoiceContext = async (
  contextSessionId: string,
  conversationId: string
) => {
  const response = await fetch("/api/voice/context/bind", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contextSessionId,
      conversationId,
    }),
  })

  if (!response.ok) {
    const data = (await response.json()) as { error?: string }
    throw new Error(data.error ?? "Failed to bind voice context")
  }
}

const VoiceModeButtonInner = ({
  context,
  className,
}: VoiceModeButtonProps) => {
  const [sessionState, setSessionState] = useState<VoiceSessionState>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const contextSessionIdRef = useRef<string | null>(null)
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null)

  const conversation = useConversation({
    onConnect: () => {
      setSessionState("active")
      setErrorMessage(null)

      const conversationId = conversationRef.current?.getId()
      const contextSessionId = contextSessionIdRef.current

      if (!conversationId || !contextSessionId) {
        return
      }

      void bindVoiceContext(contextSessionId, conversationId).catch((error) => {
        console.error("[VoiceMode] failed to bind context", error)
      })
    },
    onDisconnect: () => {
      setSessionState("idle")
      contextSessionIdRef.current = null
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
        return "Voice mode speaking"
      }

      if (conversation.isListening) {
        return "Voice mode listening"
      }

      return "Voice mode active"
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

      const response = await fetch("/api/voice/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ context }),
      })

      const data = (await response.json()) as {
        token?: string
        contextSessionId?: string
        error?: string
      }

      if (!response.ok || !data.token || !data.contextSessionId) {
        throw new Error(data.error ?? "Failed to start voice mode")
      }

      contextSessionIdRef.current = data.contextSessionId

      conversation.startSession({
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
      setSessionState("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to start voice mode"
      )
    }
  }, [context, conversation])

  const handleStopSession = useCallback(() => {
    conversation.endSession()
    contextSessionIdRef.current = null
    setSessionState("idle")
    setErrorMessage(null)
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
      if (event.key !== "Enter" && event.key !== " ") {
        return
      }

      event.preventDefault()
      handleToggle()
    },
    [handleToggle]
  )

  return (
    <div className={cn("space-y-2", className)}>
      <Button
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
        disabled={isDisabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="w-full justify-start gap-2"
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
        className={cn(
          "text-xs",
          sessionState === "error" ? "text-destructive" : "text-muted-foreground"
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
