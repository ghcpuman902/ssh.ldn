export const isVoiceModeEnabledClient = (): boolean =>
  process.env.NEXT_PUBLIC_VOICE_MODE_ENABLED === "true";
