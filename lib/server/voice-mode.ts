export const isVoiceModeEnabled = (): boolean =>
  process.env.VOICE_MODE_ENABLED === "true";

export const isVoiceModeEnabledClient = (): boolean =>
  process.env.NEXT_PUBLIC_VOICE_MODE_ENABLED === "true";

export const voiceModeDisabledResponse = (
  headers: Record<string, string> = {}
) =>
  Response.json(
    { error: "Voice mode is temporarily disabled" },
    { status: 503, headers }
  );
