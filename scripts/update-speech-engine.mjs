import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"

const apiKey = process.env.ELEVENLABS_API_KEY
const engineId = process.env.ELEVENLABS_SPEECH_ENGINE_ID

if (!apiKey) {
  console.error("Missing ELEVENLABS_API_KEY")
  process.exit(1)
}

if (!engineId) {
  console.error("Missing ELEVENLABS_SPEECH_ENGINE_ID")
  process.exit(1)
}

const elevenlabs = new ElevenLabsClient({ apiKey })

const engine = await elevenlabs.speechEngine.update(engineId, {
  tts: {
    modelId: "eleven_v3_conversational",
    expressiveMode: true,
    suggestedAudioTags: [
      { tag: "thoughtful", description: "Measured, analytical tone" },
      { tag: "reassuring", description: "Calm and helpful delivery" },
    ],
  },
  overrides: {
    firstMessage: true,
  },
})

console.log("Speech Engine updated.")
console.log(`Engine ID: ${engine.speechEngineId ?? engineId}`)
console.log(`TTS model: ${engine.tts?.modelId ?? "eleven_v3_conversational"}`)
