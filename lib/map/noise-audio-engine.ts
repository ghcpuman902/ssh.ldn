import {
  createEmptyNoiseAudioChannelLevels,
  NOISE_AUDIO_CHANNEL_IDS,
  NOISE_AUDIO_CHANNELS,
  type NoiseAudioChannelId,
  type NoiseAudioChannelLevels,
} from "@/lib/map/noise-audio-map"
import { MAP_CONFIG } from "@/lib/map/config"

const MAX_MASTER_GAIN = 0.9
const MIN_ACTIVE_MASTER_GAIN = 0.05
const GAIN_RAMP_SECONDS = 0.08
/** Below this channel gain the loop is inaudible — treat as off to avoid ghost bleed. */
const CHANNEL_GAIN_SILENCE_THRESHOLD = 0.012

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

type AudioNodes = {
  source: AudioBufferSourceNode
  gain: GainNode
}

const createAudioContext = () => {
  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextCtor) {
    throw new Error("Web Audio is not supported in this browser")
  }

  return new AudioContextCtor()
}

class NoiseAudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private nodes = new Map<NoiseAudioChannelId, AudioNodes>()
  private buffers = new Map<NoiseAudioChannelId, AudioBuffer>()
  private loading: Promise<void> | null = null
  private levels: NoiseAudioChannelLevels = createEmptyNoiseAudioChannelLevels()
  private masterLevel = 0
  private started = false
  private primed = false

  /**
   * Safari / iOS only allow Web Audio after a user gesture. Call this from
   * pointer/touch/click handlers (map pan, layer toggles) so resume happens
   * in the same turn as the gesture — not after an await.
   */
  unlockFromUserGesture() {
    const context = this.ensureContext()
    this.primeUnlock(context)

    if (context.state === "suspended") {
      void context.resume()
    }
  }

  async enable() {
    const context = this.ensureContext()

    // Resume before any await so a gesture that called enable() still counts.
    if (context.state === "suspended") {
      await context.resume()
    }

    await this.ensureBuffers()
    this.startSources()
    this.applyAllGains()

    if (context.state === "suspended") {
      await context.resume()
    }
  }

  async disable() {
    if (!this.context) return

    this.rampGain(this.masterGain, 0)

    window.setTimeout(() => {
      void this.context?.suspend()
    }, GAIN_RAMP_SECONDS * 1000)
  }

  setIntensities(nextLevels: Partial<NoiseAudioChannelLevels>) {
    this.levels = {
      ...this.levels,
      ...Object.fromEntries(
        Object.entries(nextLevels).map(([key, value]) => [key, clamp01(value)])
      ),
    }

    this.applyChannelGains()
  }

  setMasterFromZoom(zoom: number) {
    const range = MAP_CONFIG.maxZoom - MAP_CONFIG.minZoom
    const normalized = range <= 0 ? 1 : (zoom - MAP_CONFIG.minZoom) / range
    this.masterLevel =
      MIN_ACTIVE_MASTER_GAIN +
      clamp01(normalized) * (MAX_MASTER_GAIN - MIN_ACTIVE_MASTER_GAIN)

    this.rampGain(this.masterGain, this.masterLevel)
  }

  getLevels() {
    return this.levels
  }

  private ensureContext() {
    if (this.context && this.masterGain) return this.context

    const context = createAudioContext()
    const masterGain = context.createGain()
    masterGain.gain.value = 0
    masterGain.connect(context.destination)

    this.context = context
    this.masterGain = masterGain

    return context
  }

  private primeUnlock(context: AudioContext) {
    if (this.primed) return

    const buffer = context.createBuffer(1, 1, context.sampleRate)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start(0)
    this.primed = true
  }

  private async ensureBuffers() {
    if (this.buffers.size === NOISE_AUDIO_CHANNEL_IDS.length) return
    if (this.loading) return this.loading

    const context = this.ensureContext()

    this.loading = Promise.all(
      NOISE_AUDIO_CHANNEL_IDS.map(async (id) => {
        if (this.buffers.has(id)) return

        const response = await fetch(NOISE_AUDIO_CHANNELS[id].file)
        if (!response.ok) {
          throw new Error(`Failed to load noise audio: ${NOISE_AUDIO_CHANNELS[id].file}`)
        }

        const audioData = await response.arrayBuffer()
        const buffer = await context.decodeAudioData(audioData)
        this.buffers.set(id, buffer)
      })
    ).then(() => undefined)

    return this.loading
  }

  private startSources() {
    if (this.started || !this.context || !this.masterGain) return

    for (const id of NOISE_AUDIO_CHANNEL_IDS) {
      const buffer = this.buffers.get(id)
      if (!buffer) continue

      const source = this.context.createBufferSource()
      const gain = this.context.createGain()
      gain.gain.value = 0

      source.buffer = buffer
      source.loop = true
      source.connect(gain)
      gain.connect(this.masterGain)
      source.start()

      this.nodes.set(id, { source, gain })
    }

    this.started = true
  }

  private applyAllGains() {
    this.rampGain(this.masterGain, this.masterLevel)
    this.applyChannelGains()
  }

  private applyChannelGains() {
    for (const id of NOISE_AUDIO_CHANNEL_IDS) {
      const node = this.nodes.get(id)
      const channel = NOISE_AUDIO_CHANNELS[id]
      const targetGain = this.levels[id] * channel.defaultGain
      this.rampGain(
        node?.gain ?? null,
        targetGain < CHANNEL_GAIN_SILENCE_THRESHOLD ? 0 : targetGain
      )
    }
  }

  private rampGain(gain: GainNode | null, value: number) {
    if (!gain || !this.context) return

    const now = this.context.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setTargetAtTime(value, now, GAIN_RAMP_SECONDS)
  }
}

export const noiseAudioEngine = new NoiseAudioEngine()
