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

/**
 * Safari only treats these as user activation for Web Audio / autoplay.
 * Synthetic map events (movestart, dragstart) do not count.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices#autoplay_policy
 */
export const SAFARI_AUDIO_UNLOCK_EVENTS = [
  "touchstart",
  "touchend",
  "click",
  "mousedown",
  "keydown",
] as const

/** One-sample WAV so HTMLMediaElement.play() can unlock iOS media in the same gesture. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

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
  private rawFiles = new Map<NoiseAudioChannelId, ArrayBuffer>()
  private loadingFiles: Promise<void> | null = null
  private loadingDecode: Promise<void> | null = null
  private levels: NoiseAudioChannelLevels = createEmptyNoiseAudioChannelLevels()
  private masterLevel = 0
  private started = false
  private primed = false
  private keepAlive: OscillatorNode | null = null
  private silentElement: HTMLAudioElement | null = null
  private enabled = false

  /**
   * Safari / iOS: create or resume the context in this turn — not after an
   * await, React state update, or MapLibre `movestart`. Also play a silent
   * HTML audio element in the same gesture so the media session unlocks.
   */
  unlockFromUserGesture() {
    const context = this.ensureContext()
    this.enabled = true

    if (context.state === "running" && this.started) return

    this.playHtmlUnlock()
    this.primeUnlock(context)
    this.startKeepAlive(context)

    if (this.needsResume(context)) {
      void context.resume()
    }

    void this.finishEnable()
  }

  prefetch() {
    void this.ensureFiles().catch(() => undefined)
  }

  async enable() {
    this.enabled = true
    this.unlockFromUserGesture()
  }

  async disable() {
    this.enabled = false
    if (!this.context) return

    this.rampGain(this.masterGain, 0)

    window.setTimeout(() => {
      void this.context?.suspend()
    }, GAIN_RAMP_SECONDS * 1000)
  }

  isRunning() {
    return this.context?.state === "running"
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

  private async finishEnable() {
    const context = this.ensureContext()

    await this.ensureFiles()
    await this.ensureDecoded(context)
    this.startSources()
    this.applyAllGains()

    if (this.needsResume(context)) {
      await context.resume()
    }
  }

  private needsResume(context: AudioContext) {
    return (
      context.state === "suspended" ||
      (context.state as string) === "interrupted"
    )
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

  private playHtmlUnlock() {
    if (!this.silentElement) {
      const element = new Audio(SILENT_WAV)
      element.preload = "auto"
      element.loop = false
      element.volume = 0.05
      element.setAttribute("playsinline", "")
      element.setAttribute("webkit-playsinline", "")
      this.silentElement = element
    }

    this.silentElement.currentTime = 0
    const playback = this.silentElement.play()
    if (playback) {
      void playback.catch(() => undefined)
    }
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

  private startKeepAlive(context: AudioContext) {
    if (this.keepAlive) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    gain.gain.value = 0.00008
    oscillator.frequency.value = 20
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    this.keepAlive = oscillator
  }

  private async ensureFiles() {
    if (this.rawFiles.size === NOISE_AUDIO_CHANNEL_IDS.length) return
    if (this.loadingFiles) return this.loadingFiles

    this.loadingFiles = Promise.all(
      NOISE_AUDIO_CHANNEL_IDS.map(async (id) => {
        if (this.rawFiles.has(id)) return

        const response = await fetch(NOISE_AUDIO_CHANNELS[id].file)
        if (!response.ok) {
          throw new Error(
            `Failed to load noise audio: ${NOISE_AUDIO_CHANNELS[id].file}`
          )
        }

        this.rawFiles.set(id, await response.arrayBuffer())
      })
    ).then(() => undefined)

    return this.loadingFiles
  }

  private async ensureDecoded(context: AudioContext) {
    if (this.buffers.size === NOISE_AUDIO_CHANNEL_IDS.length) return
    if (this.loadingDecode) return this.loadingDecode

    this.loadingDecode = this.ensureFiles().then(() =>
      Promise.all(
        NOISE_AUDIO_CHANNEL_IDS.map(async (id) => {
          if (this.buffers.has(id)) return

          const raw = this.rawFiles.get(id)
          if (!raw) return

          const buffer = await context.decodeAudioData(raw.slice(0))
          this.buffers.set(id, buffer)
        })
      ).then(() => undefined)
    )

    return this.loadingDecode
  }

  private startSources() {
    if (this.started || !this.context || !this.masterGain || !this.enabled) {
      return
    }

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

    this.started = this.nodes.size === NOISE_AUDIO_CHANNEL_IDS.length
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
