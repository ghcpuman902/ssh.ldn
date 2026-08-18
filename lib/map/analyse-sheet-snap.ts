export const ANALYSE_SHEET_PEEK_REM = 9.5
export const ANALYSE_SHEET_HALF_RATIO = 0.5
export const ANALYSE_SHEET_FULL_RATIO = 0.92

export const ANALYSE_SHEET_SNAPS = ["peek", "half", "full"] as const

export type AnalyseSheetSnap = (typeof ANALYSE_SHEET_SNAPS)[number]

export type AnalyseSheetSnapHeights = Record<AnalyseSheetSnap, number>

export const getAnalyseSheetSnapHeights = (
  viewportHeight: number,
  rootFontSizePx: number
): AnalyseSheetSnapHeights => {
  const peek = ANALYSE_SHEET_PEEK_REM * rootFontSizePx
  const full = viewportHeight * ANALYSE_SHEET_FULL_RATIO
  const half = viewportHeight * ANALYSE_SHEET_HALF_RATIO

  return {
    peek: Math.min(peek, full),
    half: Math.min(Math.max(half, peek), full),
    full: Math.max(full, peek),
  }
}

export const clampAnalyseSheetHeight = (
  height: number,
  heights: AnalyseSheetSnapHeights
) => Math.min(heights.full, Math.max(heights.peek, height))

export const nearestAnalyseSheetSnap = (
  height: number,
  heights: AnalyseSheetSnapHeights
): AnalyseSheetSnap => {
  let nearest: AnalyseSheetSnap = "peek"
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const snap of ANALYSE_SHEET_SNAPS) {
    const distance = Math.abs(height - heights[snap])
    if (distance < nearestDistance) {
      nearest = snap
      nearestDistance = distance
    }
  }

  return nearest
}

const SNAP_FLICK_PX_PER_MS = 0.55

export const resolveAnalyseSheetReleaseSnap = ({
  height,
  velocityPxPerMs,
  heights,
}: {
  height: number
  velocityPxPerMs: number
  heights: AnalyseSheetSnapHeights
}): AnalyseSheetSnap => {
  const nearest = nearestAnalyseSheetSnap(height, heights)
  const nearestIndex = ANALYSE_SHEET_SNAPS.indexOf(nearest)

  if (velocityPxPerMs < -SNAP_FLICK_PX_PER_MS) {
    return ANALYSE_SHEET_SNAPS[Math.min(nearestIndex + 1, ANALYSE_SHEET_SNAPS.length - 1)]
  }

  if (velocityPxPerMs > SNAP_FLICK_PX_PER_MS) {
    return ANALYSE_SHEET_SNAPS[Math.max(nearestIndex - 1, 0)]
  }

  return nearest
}

export const nextAnalyseSheetSnap = (
  snap: AnalyseSheetSnap,
  direction: 1 | -1
): AnalyseSheetSnap => {
  const index = ANALYSE_SHEET_SNAPS.indexOf(snap)
  const nextIndex = Math.min(
    ANALYSE_SHEET_SNAPS.length - 1,
    Math.max(0, index + direction)
  )

  return ANALYSE_SHEET_SNAPS[nextIndex]
}
