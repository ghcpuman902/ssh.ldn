import {
  DEFAULT_NOISE_LAYER_VISIBILITY,
  type NoiseLayerVisibility,
} from "@/components/map/noise-map-layers"
import {
  DEFAULT_VISUAL_LAYER_VISIBILITY,
  type VisualLayerVisibility,
} from "@/lib/map/visual-layers"

const NOISE_LAYER_VISIBILITY_KEY = "ssh.ldn.noise-layer-visibility"
const VISUAL_LAYER_VISIBILITY_KEY = "ssh.ldn.visual-layer-visibility"

const readBooleanRecord = <T extends Record<string, boolean>>(
  raw: string | null,
  defaults: T
): T => {
  if (!raw) {
    return defaults
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>

    if (!parsed || typeof parsed !== "object") {
      return defaults
    }

    const next = { ...defaults }

    for (const key of Object.keys(defaults)) {
      if (typeof parsed[key] === "boolean") {
        next[key as keyof T] = parsed[key] as T[keyof T]
      }
    }

    return next
  } catch {
    return defaults
  }
}

export const readNoiseLayerVisibility = (): NoiseLayerVisibility => {
  if (typeof window === "undefined") {
    return DEFAULT_NOISE_LAYER_VISIBILITY
  }

  return readBooleanRecord(
    window.localStorage.getItem(NOISE_LAYER_VISIBILITY_KEY),
    DEFAULT_NOISE_LAYER_VISIBILITY
  )
}

export const writeNoiseLayerVisibility = (
  visibility: NoiseLayerVisibility
): void => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    NOISE_LAYER_VISIBILITY_KEY,
    JSON.stringify(visibility)
  )
}

export const readVisualLayerVisibility = (): VisualLayerVisibility => {
  if (typeof window === "undefined") {
    return DEFAULT_VISUAL_LAYER_VISIBILITY
  }

  return readBooleanRecord(
    window.localStorage.getItem(VISUAL_LAYER_VISIBILITY_KEY),
    DEFAULT_VISUAL_LAYER_VISIBILITY
  )
}

export const writeVisualLayerVisibility = (
  visibility: VisualLayerVisibility
): void => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    VISUAL_LAYER_VISIBILITY_KEY,
    JSON.stringify(visibility)
  )
}
