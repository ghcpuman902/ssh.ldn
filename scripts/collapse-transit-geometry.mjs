/**
 * Compress OSM route variants into unique track, then Douglas-Peucker.
 *
 * OSM stores every timetable pattern as its own relation (both directions,
 * every branch combo). Shorter ones are subsets of longer ones — drawing
 * them all just stacks the same corridor. We keep the longest spine and
 * only the leftover branch geometry that is not already on that spine.
 */
export const PREVIEW_SIMPLIFY_DEG = 0.00035
export const FULL_SIMPLIFY_DEG = 0.00004

const SNAP_DECIMALS = 4
const DENSIFY_SPACING = 0.00015
const MIN_BRANCH_LENGTH = 0.02
const MAX_SHAPES_PER_LINE = 4

const snapKey = (lng, lat) =>
  `${lng.toFixed(SNAP_DECIMALS)},${lat.toFixed(SNAP_DECIMALS)}`

const lineLength = (coords) => {
  let length = 0
  for (let index = 1; index < coords.length; index += 1) {
    length += Math.hypot(
      coords[index][0] - coords[index - 1][0],
      coords[index][1] - coords[index - 1][1]
    )
  }
  return length
}

const perpDistance = (point, start, end) => {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1])
  }

  let t =
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))

  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dy)
  )
}

export const simplifyDouglasPeucker = (coordinates, epsilon) => {
  if (coordinates.length <= 2) return coordinates

  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]
  let maxDistance = 0
  let maxIndex = 0

  for (let index = 1; index < coordinates.length - 1; index += 1) {
    const distance = perpDistance(coordinates[index], first, last)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = index
    }
  }

  if (maxDistance <= epsilon) return [first, last]

  const left = simplifyDouglasPeucker(
    coordinates.slice(0, maxIndex + 1),
    epsilon
  )
  const right = simplifyDouglasPeucker(coordinates.slice(maxIndex), epsilon)
  return [...left.slice(0, -1), ...right]
}

const interpolate = (start, end, t) => [
  start[0] + (end[0] - start[0]) * t,
  start[1] + (end[1] - start[1]) * t,
]

const densifyLine = (coordinates) => {
  if (coordinates.length < 2) return coordinates

  const densified = [coordinates[0]]

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index]
    const end = coordinates[index + 1]
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1])
    const steps = Math.max(1, Math.round(distance / DENSIFY_SPACING))

    for (let step = 1; step <= steps; step += 1) {
      densified.push(interpolate(start, end, step / steps))
    }
  }

  return densified
}

const samePoint = (left, right) =>
  Math.abs(left[0] - right[0]) < 1e-6 && Math.abs(left[1] - right[1]) < 1e-6

const rejoinOffsetSplits = (features) => {
  const groups = new Map()

  for (const feature of features) {
    const raw = String(feature.id ?? feature.properties.featureId)
    const match = raw.match(/^(.*)-(\d+)$/)
    const base = match ? match[1] : raw
    const run = match ? Number(match[2]) : 0
    const list = groups.get(base) ?? []
    list.push({ run, feature })
    groups.set(base, list)
  }

  const rejoined = []

  for (const [base, pieces] of groups) {
    pieces.sort((left, right) => left.run - right.run)
    const coordinates = []

    for (const piece of pieces) {
      const next = piece.feature.geometry.coordinates
      if (
        coordinates.length > 0 &&
        next.length > 0 &&
        samePoint(coordinates[coordinates.length - 1], next[0])
      ) {
        coordinates.push(...next.slice(1))
      } else {
        coordinates.push(...next)
      }
    }

    if (coordinates.length < 2) continue

    const template = pieces[0].feature
    rejoined.push({
      ...template,
      id: base,
      properties: { ...template.properties, featureId: base },
      geometry: { type: "LineString", coordinates },
    })
  }

  return rejoined
}

const coverNodes = (coordinates, covered) => {
  for (const point of densifyLine(coordinates)) {
    covered.add(snapKey(point[0], point[1]))
  }
}

/** Walk a variant and keep only runs that are not already on the spine. */
const extractUncoveredRuns = (coordinates, covered) => {
  const densified = densifyLine(coordinates)
  const runs = []
  let current = []
  let lastCovered = null

  const flush = (junction) => {
    if (junction) current.push(junction)
    if (current.length >= 2 && lineLength(current) >= MIN_BRANCH_LENGTH) {
      runs.push(current)
    }
    current = []
  }

  for (const point of densified) {
    if (covered.has(snapKey(point[0], point[1]))) {
      if (current.length > 0) flush(point)
      lastCovered = point
      continue
    }

    if (current.length === 0 && lastCovered) current.push(lastCovered)
    current.push(point)
  }

  flush(null)
  return runs
}

/**
 * Longest OSM relation as the spine; other relations contribute only the
 * leftover branch geometry (reverses and shorter subsets add nothing).
 */
const uniqueShapesForLine = (features) => {
  const ranked = [...rejoinOffsetSplits(features)].sort(
    (left, right) =>
      lineLength(right.geometry.coordinates) -
      lineLength(left.geometry.coordinates)
  )

  if (ranked.length === 0) return []

  const shapes = [ranked[0].geometry.coordinates]
  const covered = new Set()
  coverNodes(shapes[0], covered)

  for (const feature of ranked.slice(1)) {
    if (shapes.length >= MAX_SHAPES_PER_LINE) break

    for (const run of extractUncoveredRuns(
      feature.geometry.coordinates,
      covered
    )) {
      shapes.push(run)
      coverNodes(run, covered)
      if (shapes.length >= MAX_SHAPES_PER_LINE) break
    }
  }

  return shapes
}

export const collapseLineFeatures = (features, epsilon) => {
  const grouped = new Map()

  for (const feature of features) {
    const lineId = feature.properties.lineId
    const list = grouped.get(lineId) ?? []
    list.push(feature)
    grouped.set(lineId, list)
  }

  const collapsed = []

  for (const [lineId, lineFeatures] of grouped) {
    const template = lineFeatures[0]
    const shapes = uniqueShapesForLine(lineFeatures)

    shapes.forEach((shape, index) => {
      const coordinates = simplifyDouglasPeucker(shape, epsilon)
      if (coordinates.length < 4 || lineLength(coordinates) < MIN_BRANCH_LENGTH) {
        if (index > 0) return
        if (coordinates.length < 2) return
      }

      const featureId = `${lineId}-track-${index}`
      collapsed.push({
        type: "Feature",
        id: featureId,
        properties: {
          featureId,
          lineId,
          lineName: template.properties.lineName,
          color: template.properties.color,
        },
        geometry: {
          type: "LineString",
          coordinates,
        },
      })
    })
  }

  return collapsed
}

export const collapseTransitBundle = (bundle, epsilon) => {
  const features = collapseLineFeatures(bundle.lines?.features ?? [], epsilon)

  return {
    stations: bundle.stations,
    lines: {
      type: "FeatureCollection",
      features,
      meta: {
        ...(bundle.lines?.meta ?? {}),
        source:
          epsilon >= PREVIEW_SIMPLIFY_DEG
            ? "osm-simplified"
            : "osm-route-network",
        filter:
          "Longest spine plus unique branches only; reverse/subset variants dropped",
        featureCount: features.length,
      },
    },
  }
}
