const DEFAULT_PRODUCTION_VOICE_API_URL = "https://ssh-ldn.app"

export const getVoiceApiBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_VOICE_API_URL?.replace(/\/$/, "")

  if (configured) {
    return configured
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_PRODUCTION_VOICE_API_URL
  }

  return ""
}

export const voiceApiUrl = (path: string) => {
  const base = getVoiceApiBaseUrl()
  return `${base}${path}`
}
