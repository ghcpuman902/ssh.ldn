const squircleBezier = (a: number) => ({
  p: a * 0.515,
  q: a * 0.344,
  s: a * 0.068,
  m: a * 0.206,
})

const squircleRadius = (radius: number, w: number, h: number) => {
  const maxR = Math.min(w, h) / 2
  return Math.min(radius * 1.15, maxR)
}

/** Cubic constant — quarter-circle approximation (not squircle). */
const K = 0.5522847498

const squircleBl = (x: number, bottom: number, a: number) => {
  const { p, q, s, m } = squircleBezier(a)
  return [
    `C ${x} ${bottom - p} ${x + s} ${bottom - q} ${x + m} ${bottom - m}`,
    `C ${x + q} ${bottom - s} ${x + p} ${bottom} ${x + a} ${bottom}`,
  ]
}

const squircleBr = (right: number, bottom: number, a: number) => {
  const { p, q, s, m } = squircleBezier(a)
  return [
    `C ${right - p} ${bottom} ${right - q} ${bottom - s} ${right - m} ${bottom - m}`,
    `C ${right - s} ${bottom - q} ${right} ${bottom - p} ${right} ${bottom - a}`,
  ]
}

const squircleTr = (right: number, y: number, a: number) => {
  const { p, q, s, m } = squircleBezier(a)
  return [
    `C ${right} ${y + p} ${right - s} ${y + q} ${right - m} ${y + m}`,
    `C ${right - q} ${y + s} ${right - p} ${y} ${right - a} ${y}`,
  ]
}

/** Simple cubic corner — circular quarter, used for logo pocket + top-left. */
const simpleTr = (cornerX: number, y: number, r: number) =>
  `C ${cornerX + r - r * K} ${y} ${cornerX} ${y + r * K} ${cornerX} ${y + r}`

const simpleBr = (cornerX: number, bottom: number, r: number) =>
  `C ${cornerX} ${bottom - r * K} ${cornerX - r * K} ${bottom} ${cornerX - r} ${bottom}`

const simpleBl = (x: number, bottom: number, r: number) =>
  `C ${x + r * K} ${bottom} ${x} ${bottom - r * K} ${x} ${bottom - r}`

const simpleTl = (x: number, y: number, r: number) =>
  `C ${x} ${y + r * K} ${x + r * K} ${y} ${x + r} ${y}`

/** Left wall of the logo notch — simple bezier bulge, not squircle. */
const simpleLogoLeftBend = (
  x: number,
  y0: number,
  y1: number,
  bend: number
) =>
  `C ${x + bend * K} ${y0} ${x + bend * K} ${y1} ${x} ${y1}`

export type InletRect = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

/** Debug anchor — see red overlays in map-shell when MAP_CLIP_DEBUG is on. */
export type MapClipDebugPoint = {
  id: string
  label: string
  x: number
  y: number
}

export type MapClipGeometry = {
  path: string
  debugPoints: MapClipDebugPoint[]
}

const buildInletDebugPoints = (
  x: number,
  iy: number,
  iRight: number,
  iBottom: number,
  r: number,
  leftBelowPocket: number
): MapClipDebugPoint[] => [
  {
    id: "path-m",
    label: "M — path start / left-bend end (line 219)",
    x,
    y: leftBelowPocket,
  },
  {
    id: "pocket-br-line-start",
    label: "L before simpleBr (line 228)",
    x: iRight,
    y: iBottom - r,
  },
  {
    id: "pocket-br-end",
    label: "simpleBr end (line 229)",
    x: iRight - r,
    y: iBottom,
  },
  {
    id: "pocket-bottom-line-end",
    label: "L before simpleBl (line 230)",
    x: x + r,
    y: iBottom,
  },
  {
    id: "pocket-bl-end",
    label: "simpleBl end (line 231)",
    x,
    y: iBottom - r,
  },
  {
    id: "left-bend-start",
    label: "simpleLogoLeftBend start (line 232)",
    x,
    y: iBottom - r,
  },
  {
    id: "left-bend-end",
    label: "simpleLogoLeftBend end → path-m (line 232)",
    x,
    y: leftBelowPocket,
  },
  {
    id: "pocket-tr-end",
    label: "simpleTr end — good reference (line 227)",
    x: iRight,
    y: iy + r,
  },
]

/** Frame without logo — squircle TR/BR/BL, simple bezier top-left. */
export const buildSquirclePath = (
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): string => {
  const a = squircleRadius(radius, w, h)
  const tl = Math.min(radius, a)

  const right = x + w
  const bottom = y + h

  return [
    `M ${x + tl} ${y}`,
    `L ${right - a} ${y}`,
    ...squircleTr(right, y, a),
    `L ${right} ${bottom - a}`,
    ...squircleBr(right, bottom, a),
    `L ${x + a} ${bottom}`,
    ...squircleBl(x, bottom, a),
    `L ${x} ${y + tl}`,
    simpleTl(x, y, tl),
    "Z",
  ].join(" ")
}

/**
 * Map window clip path.
 * Squircle on TR / BR / BL only; top-left + logo notch use simple cubics.
 */
export const buildMapClipPathWithInlet = (
  x: number,
  y: number,
  w: number,
  h: number,
  cornerRadius: number,
  inlet?: InletRect | null
): string => buildMapClipGeometry(x, y, w, h, cornerRadius, inlet).path

/** Path + red debug anchor positions for the logo pocket. */
export const buildMapClipGeometry = (
  x: number,
  y: number,
  w: number,
  h: number,
  cornerRadius: number,
  inlet?: InletRect | null
): MapClipGeometry => {
  if (!inlet || inlet.width <= 0 || inlet.height <= 0) {
    return { path: buildSquirclePath(x, y, w, h, cornerRadius), debugPoints: [] }
  }

  const a = squircleRadius(cornerRadius, w, h)
  const r = Math.min(
    inlet.radius,
    inlet.width / 2,
    inlet.height / 2,
    a
  )

  const right = x + w
  const bottom = y + h

  const ix = x + inlet.x
  const iy = y + inlet.y
  const iRight = ix + inlet.width
  const iBottom = iy + inlet.height

  const topEntryX = iRight + r
  const leftBelowPocket = iBottom + r

  if (topEntryX >= right - a - 1) {
    return { path: buildSquirclePath(x, y, w, h, cornerRadius), debugPoints: [] }
  }

  const path = [
    `M ${x} ${leftBelowPocket}`, // DEBUG: path-m
    `L ${x} ${bottom - a}`,
    ...squircleBl(x, bottom, a),
    `L ${right - a} ${bottom}`,
    ...squircleBr(right, bottom, a),
    `L ${right} ${y + a}`,
    ...squircleTr(right, y, a),
    `L ${topEntryX} ${iy}`,
    simpleTr(iRight, iy, r), // DEBUG: pocket-tr-end (good reference)
    `L ${iRight} ${iBottom - r}`, // DEBUG: pocket-br-line-start
    simpleBr(iRight, iBottom, r), // DEBUG: pocket-br-end
    `L ${ix + r} ${iBottom}`, // DEBUG: pocket-bottom-line-end
    simpleBl(x, iBottom, r), // DEBUG: pocket-bl-end / left-bend-start
    simpleLogoLeftBend(x, iBottom - r, leftBelowPocket, r), // DEBUG: left-bend-end → path-m
    "Z",
  ].join(" ")

  return {
    path,
    debugPoints: buildInletDebugPoints(
      x,
      iy,
      iRight,
      iBottom,
      r,
      leftBelowPocket
    ),
  }
}

export const toClipPath = (path: string) =>
  path ? `path("${path}")` : "none"
