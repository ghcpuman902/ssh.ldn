import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"

const apiKey = process.env.ELEVENLABS_API_KEY
const publicWsUrl = process.env.PUBLIC_WS_URL

if (!apiKey) {
  console.error("Missing ELEVENLABS_API_KEY")
  process.exit(1)
}

if (!publicWsUrl) {
  console.error(
    "Missing PUBLIC_WS_URL. Example: wss://your-app.vercel.app/api/voice/ws"
  )
  process.exit(1)
}

const elevenlabs = new ElevenLabsClient({ apiKey })

const engine = await elevenlabs.speechEngine.create({
  name: "ssh.ldn location voice",
  speechEngine: {
    wsUrl: publicWsUrl,
  },
  overrides: {
    firstMessage: true,
  },
  tts: {
    modelId: "eleven_v3_conversational",
    expressiveMode: true,
    suggestedAudioTags: [
      { tag: "thoughtful", description: "Measured, analytical tone" },
      { tag: "reassuring", description: "Calm and helpful delivery" },
    ],
  },
  asr: {
    provider: "scribe_realtime",
    keywords: ["ssh.ldn", "London", "noise", "DEFRA"],
  },
  turn: {
    turnEagerness: "normal",
    speculativeTurn: true,
  },
  privacy: {
    recordVoice: false,
  },
})

console.log("Speech Engine created.")
console.log(`ELEVENLABS_SPEECH_ENGINE_ID=${engine.engineId}`)
console.log("")
console.log("Add the engine ID to .env.local and Vercel project env, then redeploy.")
