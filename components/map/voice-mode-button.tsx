"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ConversationProvider, useConversation } from "@elevenlabs/react"
import { Loader2, Mic, MicOff, VolumeX } from "lucide-react"

import { ElevenLabsMark } from "@/components/map/elevenlabs-mark"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
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
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [userTranscriptLine, setUserTranscriptLine] = useState<string | null>(
    null
  )
  const contextSessionIdRef = useRef<string | null>(null)
  const contextRef = useRef<LocationContext | null>(null)
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(
    null
  )
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const microphoneAudioContextRef = useRef<AudioContext | null>(null)
  const microphoneAnimationFrameRef = useRef<number | null>(null)
  const microphoneLevelUpdatedAtRef = useRef(0)
  const microphoneTrackRef = useRef<MediaStreamTrack | null>(null)

  const setLocalMicrophoneMuted = useCallback((muted: boolean) => {
    if (microphoneTrackRef.current) {
      microphoneTrackRef.current.enabled = !muted
    }

    if (muted) {
      setMicrophoneLevel(0)
    }
  }, [])

  const stopMicrophoneMonitor = useCallback(() => {
    if (microphoneAnimationFrameRef.current !== null) {
      cancelAnimationFrame(microphoneAnimationFrameRef.current)
      microphoneAnimationFrameRef.current = null
    }

    microphoneStreamRef.current?.getTracks().forEach((track) => {
      track.stop()
    })
    microphoneStreamRef.current = null
    microphoneTrackRef.current = null

    void microphoneAudioContextRef.current?.close()
    microphoneAudioContextRef.current = null
    microphoneLevelUpdatedAtRef.current = 0
    setMicrophoneLevel(0)
  }, [])

  const startMicrophoneMonitor = useCallback(
    (stream: MediaStream) => {
      stopMicrophoneMonitor()

      const audioTrack = stream.getAudioTracks()[0] ?? null
      microphoneTrackRef.current = audioTrack

      const AudioContextConstructor =
        window.AudioContext ??
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext

      if (!AudioContextConstructor) {
        return
      }

      const audioContext = new AudioContextConstructor()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)

      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.75
      const samples = new Uint8Array(analyser.fftSize)
      source.connect(analyser)

      microphoneStreamRef.current = stream
      microphoneAudioContextRef.current = audioContext

      const updateLevel = (timestamp: number) => {
        if (audioTrack && !audioTrack.enabled) {
          setMicrophoneLevel(0)
          microphoneAnimationFrameRef.current = requestAnimationFrame(updateLevel)
          return
        }

        analyser.getByteTimeDomainData(samples)

        let sum = 0

        for (const sample of samples) {
          const centeredSample = (sample - 128) / 128
          sum += centeredSample * centeredSample
        }

        if (timestamp - microphoneLevelUpdatedAtRef.current > 80) {
          const rms = Math.sqrt(sum / samples.length)
          setMicrophoneLevel(Math.min(100, Math.round(rms * 180)))
          microphoneLevelUpdatedAtRef.current = timestamp
        }

        microphoneAnimationFrameRef.current = requestAnimationFrame(updateLevel)
      }

      microphoneAnimationFrameRef.current = requestAnimationFrame(updateLevel)
    },
    [stopMicrophoneMonitor]
  )

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
      setUserTranscriptLine(null)
      contextSessionIdRef.current = null
      contextRef.current = null
      stopMicrophoneMonitor()
    },
    onError: (message) => {
      setSessionState("error")
      setErrorMessage(message || "Voice mode failed")
      setUserTranscriptLine(null)
      stopMicrophoneMonitor()
    },
    onMessage: ({ message, role }) => {
      if (role !== "user") {
        return
      }

      const trimmed = message.trim()

      if (!trimmed) {
        return
      }

      setUserTranscriptLine(trimmed)
    },
  })

  conversationRef.current = conversation

  const isDisabled = !context || sessionState === "connecting"
  const isActive = sessionState === "active"

  const transcriptPreview = useMemo(() => {
    if (!isActive) {
      return null
    }

    if (conversation.isMuted) {
      return "Microphone muted"
    }

    if (userTranscriptLine) {
      return userTranscriptLine
    }

    if (conversation.isListening) {
      return "Listening…"
    }

    if (conversation.isSpeaking) {
      return "Speaking…"
    }

    return "Ready to listen"
  }, [
    conversation.isListening,
    conversation.isMuted,
    conversation.isSpeaking,
    isActive,
    userTranscriptLine,
  ])

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
    setUserTranscriptLine(null)

    try {
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      startMicrophoneMonitor(microphoneStream)

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
      stopMicrophoneMonitor()
      setSessionState("error")
      setErrorMessage(formatVoiceStartError(error))
      buttonRef.current?.focus()
    }
  }, [context, conversation, startMicrophoneMonitor, stopMicrophoneMonitor])

  const handleStopSession = useCallback(() => {
    if (conversation.isMuted) {
      conversation.setMuted(false)
    }

    conversation.endSession()
    contextSessionIdRef.current = null
    contextRef.current = null
    stopMicrophoneMonitor()
    setUserTranscriptLine(null)
    setSessionState("idle")
    setErrorMessage(null)
    buttonRef.current?.focus()
  }, [conversation, stopMicrophoneMonitor])

  const handleToggleMicMute = useCallback(() => {
    const nextMuted = !conversation.isMuted
    conversation.setMuted(nextMuted)
    setLocalMicrophoneMuted(nextMuted)
  }, [conversation, setLocalMicrophoneMuted])

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

  useEffect(() => {
    return () => {
      stopMicrophoneMonitor()
    }
  }, [stopMicrophoneMonitor])

  return (
    <div
      className={cn(
        "space-y-2 rounded-4xl border border-border/60 bg-white p-3",
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

      <div className="space-y-1 px-1" aria-label="Microphone input level">
        <div className="flex items-center justify-between gap-2 text-[0.7rem] text-muted-foreground">
          <span>Mic input</span>
          <div className="flex items-center gap-2">
            <span>{conversation.isMuted ? "Muted" : `${microphoneLevel}%`}</span>
            <Button
              type="button"
              variant={conversation.isMuted ? "secondary" : "outline"}
              size="icon-xs"
              aria-label={
                conversation.isMuted
                  ? "Unmute microphone input"
                  : "Mute microphone input for noisy environments"
              }
              aria-pressed={conversation.isMuted}
              disabled={!isActive}
              onClick={handleToggleMicMute}
              className="size-7 rounded-full"
            >
              {conversation.isMuted ? (
                <VolumeX className="size-3.5" aria-hidden="true" />
              ) : (
                <Mic className="size-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        <Progress
          value={conversation.isMuted ? 0 : microphoneLevel}
          aria-label="Microphone input level"
          className="h-1.5"
        />
      </div>

      {transcriptPreview ? (
        <p
          id="voice-mode-transcript"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          title={userTranscriptLine ?? undefined}
          className={cn(
            "truncate px-1 text-xs",
            userTranscriptLine
              ? "text-foreground"
              : "text-muted-foreground italic"
          )}
        >
          {userTranscriptLine ? `"${transcriptPreview}"` : transcriptPreview}
        </p>
      ) : null}

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

      <ElevenLabsMark className="px-1 pt-0.5" />
    </div>
  )
}

export const VoiceModeButton = (props: VoiceModeButtonProps) => (
  <ConversationProvider>
    <VoiceModeButtonInner {...props} />
  </ConversationProvider>
)
