import type { TubeLineFeatureCollection } from "@/lib/map/geojson-types"

type TubeLineFeature = TubeLineFeatureCollection["features"][number]

const MIN_TRACK_FOLLOWING_COORDS = 30

export const isOsmRouteRelationFeature = (feature: TubeLineFeature) =>
  String(feature.id ?? feature.properties.featureId).startsWith("relation/")

/** OSM route relations follow ways; TfL lineStrings are stop-order chords (~≤27 pts). */
export const isTrackFollowingFeature = (feature: TubeLineFeature) =>
  isOsmRouteRelationFeature(feature) ||
  feature.geometry.coordinates.length >= MIN_TRACK_FOLLOWING_COORDS

const groupFeaturesByLineId = (features: TubeLineFeature[]) => {
  const grouped = new Map<string, TubeLineFeature[]>()

  for (const feature of features) {
    const lineId = feature.properties.lineId
    const list = grouped.get(lineId) ?? []
    list.push(feature)
    grouped.set(lineId, list)
  }

  return grouped
}

/**
 * TfL route sequences enumerate every branch, but they are schematic polylines.
 * Prefer OSM route relations whenever they exist for a line.
 */
export const selectLineFeatures = (
  osmFeatures: TubeLineFeature[],
  tflFeatures: TubeLineFeature[],
): TubeLineFeature[] => {
  if (osmFeatures.length === 0) return tflFeatures
  if (tflFeatures.length === 0) return osmFeatures

  const osmByLine = groupFeaturesByLineId(osmFeatures)
  const tflByLine = groupFeaturesByLineId(tflFeatures)
  const lineIds = new Set([...osmByLine.keys(), ...tflByLine.keys()])
  const selected: TubeLineFeature[] = []

  for (const lineId of lineIds) {
    const osm = osmByLine.get(lineId) ?? []
    const tfl = tflByLine.get(lineId) ?? []

    if (tfl.length === 0) {
      selected.push(...osm)
      continue
    }

    if (osm.length === 0) {
      selected.push(...tfl)
      continue
    }

    const osmTrackFollowing = osm.filter(isTrackFollowingFeature)
    selected.push(...(osmTrackFollowing.length > 0 ? osmTrackFollowing : tfl))
  }

  return selected
}
