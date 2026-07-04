import type { LocationContext } from "@/lib/voice/location-context"

type StoredVoiceContext = {
  context: LocationContext
  expiresAt: number
}

type ConversationVoiceContext = {
  context: LocationContext
  expiresAt: number
}

const CONTEXT_TTL_MS = 30 * 60 * 1000

const pendingContexts = new Map<string, StoredVoiceContext>()
const conversationContexts = new Map<string, ConversationVoiceContext>()

const pruneExpired = <T extends { expiresAt: number }>(store: Map<string, T>) => {
  const now = Date.now()

  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key)
    }
  }
}

export const storePendingVoiceContext = (context: LocationContext) => {
  pruneExpired(pendingContexts)

  const contextSessionId = crypto.randomUUID()
  pendingContexts.set(contextSessionId, {
    context,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  })

  return contextSessionId
}

export const bindVoiceContextToConversation = (
  contextSessionId: string,
  conversationId: string,
  context?: LocationContext
) => {
  pruneExpired(pendingContexts)
  pruneExpired(conversationContexts)

  const pending = pendingContexts.get(contextSessionId)
  const resolvedContext = pending?.context ?? context

  if (!resolvedContext) {
    return false
  }

  conversationContexts.set(conversationId, {
    context: resolvedContext,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  })
  pendingContexts.delete(contextSessionId)

  return true
}

export const getVoiceContextForConversation = (conversationId: string) => {
  pruneExpired(conversationContexts)

  const stored = conversationContexts.get(conversationId)

  if (!stored) {
    return null
  }

  return stored.context
}

export const clearVoiceContextForConversation = (conversationId: string) => {
  conversationContexts.delete(conversationId)
}
