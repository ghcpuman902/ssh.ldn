type OklchStop = { score: number; l: number; c: number; h: number }

/** Muted air-quality-style spectrum: quiet teal-green → yellow → orange → red. */
const NOISE_SCORE_COLOR_STOPS: OklchStop[] = [
  { score: 0, l: 0.72, c: 0.1, h: 155 },
  { score: 25, l: 0.74, c: 0.09, h: 145 },
  { score: 50, l: 0.8, c: 0.1, h: 100 },
  { score: 75, l: 0.72, c: 0.12, h: 55 },
  { score: 100, l: 0.58, c: 0.14, h: 25 },
]

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

const lerpHue = (from: number, to: number, t: number) => {
  let delta = to - from
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return (from + delta * t + 360) % 360
}

const interpolateStops = (score: number, stops: OklchStop[]) => {
  const clamped = Math.min(100, Math.max(0, score))
  let lower = stops[0]
  let upper = stops[stops.length - 1]

  for (let index = 0; index < stops.length - 1; index += 1) {
    const current = stops[index]
    const next = stops[index + 1]
    if (clamped >= current.score && clamped <= next.score) {
      lower = current
      upper = next
      break
    }
  }

  const range = upper.score - lower.score
  const t = range === 0 ? 0 : (clamped - lower.score) / range

  return {
    l: lerp(lower.l, upper.l, t),
    c: lerp(lower.c, upper.c, t),
    h: lerpHue(lower.h, upper.h, t),
  }
}

export const getNoiseScoreColor = (score: number) => {
  const { l, c, h } = interpolateStops(score, NOISE_SCORE_COLOR_STOPS)
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}

const gammaEncode = (channel: number) => {
  const clamped = Math.min(1, Math.max(0, channel))
  if (clamped <= 0.0031308) return 12.92 * clamped
  return 1.055 * clamped ** (1 / 2.4) - 0.055
}

/** sRGB hex for contexts that cannot paint oklch (share-card images). */
export const getNoiseScoreHex = (score: number) => {
  const { l, c, h } = interpolateStops(score, NOISE_SCORE_COLOR_STOPS)
  const hue = (h * Math.PI) / 180
  const a = c * Math.cos(hue)
  const b = c * Math.sin(hue)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const l3 = l_ ** 3
  const m3 = m_ ** 3
  const s3 = s_ ** 3
  const linear = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]

  const hex = linear
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, gammaEncode(channel))) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")

  return `#${hex}`
}
