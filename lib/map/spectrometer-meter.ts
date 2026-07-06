export type MeterPair = {
  instant: number
  peak: number
}

export const PEAK_DECAY_RATE = 4.8
export const INSTANT_SMOOTHING = 28
export const INSTANT_FLOOR_RATIO = 0.84
export const PEAK_OPACITY = 0.38
export const INSTANT_OPACITY = 0.9

export const getModulatedInstant = (
  base: number,
  timeSeconds: number,
  phase: number
) => {
  if (base <= 0) return 0

  const highFrequency =
    Math.sin(timeSeconds * 15 + phase) * 0.07 +
    Math.sin(timeSeconds * 24 + phase * 1.35) * 0.05 +
    Math.sin(timeSeconds * 38 + phase * 0.65) * 0.035

  const raw = base * (1 + highFrequency)
  const floor = base * INSTANT_FLOOR_RATIO

  return Math.min(100, Math.max(floor, raw))
}

export const updateSpectrometerMeter = (
  meter: MeterPair,
  target: number,
  timeSeconds: number,
  phase: number,
  deltaSeconds: number,
  staticMode: boolean
): MeterPair => {
  const modulatedTarget = staticMode
    ? target
    : getModulatedInstant(target, timeSeconds, phase)

  const instant =
    meter.instant +
    (modulatedTarget - meter.instant) *
      Math.min(1, deltaSeconds * INSTANT_SMOOTHING)

  let peak = meter.peak
  if (instant >= peak) {
    peak = instant
  } else {
    peak *= Math.exp(-deltaSeconds * PEAK_DECAY_RATE)
  }

  if (target <= 0 && instant < 0.4) {
    return { instant: 0, peak: 0 }
  }

  return { instant, peak }
}

export const getSpectrometerGeometry = (size: number) => {
  const center = size / 2
  const innerRadius = center - 1
  const fillHeight = innerRadius * 2
  const fillBottom = center + innerRadius
  const fillLeft = center - innerRadius
  const fillRight = center + innerRadius

  return {
    size,
    center,
    innerRadius,
    fillHeight,
    fillBottom,
    fillLeft,
    fillRight,
  }
}

export const buildSpectrometerFlatFill = (
  topY: number,
  bottomY: number,
  geometry: ReturnType<typeof getSpectrometerGeometry>
) =>
  `M ${geometry.fillLeft} ${bottomY} L ${geometry.fillRight} ${bottomY} L ${geometry.fillRight} ${topY} L ${geometry.fillLeft} ${topY} Z`

export const spectrometerLevelToTop = (
  level: number,
  geometry: ReturnType<typeof getSpectrometerGeometry>
) => geometry.fillBottom - (level / 100) * geometry.fillHeight
