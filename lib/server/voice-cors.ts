const DEFAULT_ALLOWED_ORIGINS = ["https://sshldn.vercel.app"]

const isLocalDevelopmentOrigin = (origin: string) => {
  try {
    const url = new URL(origin)
    return (
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]") &&
      (url.protocol === "http:" || url.protocol === "https:")
    )
  } catch {
    return false
  }
}

const getConfiguredAllowedOrigins = () => {
  const configured = process.env.VOICE_ALLOWED_ORIGINS

  if (!configured) {
    return DEFAULT_ALLOWED_ORIGINS
  }

  return configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
}

export const getVoiceCorsHeaders = (
  request: Request
): Record<string, string> => {
  const origin = request.headers.get("origin")?.replace(/\/$/, "")

  if (!origin) {
    return {}
  }

  const isAllowed =
    isLocalDevelopmentOrigin(origin) ||
    getConfiguredAllowedOrigins().includes(origin)

  if (!isAllowed) {
    return { Vary: "Origin" }
  }

  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  }
}

export const voiceOptionsResponse = (request: Request) =>
  new Response(null, {
    status: 204,
    headers: getVoiceCorsHeaders(request),
  })
