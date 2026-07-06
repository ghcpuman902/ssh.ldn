import type { TubeLineFeatureCollection } from "@/lib/map/geojson-types";

type CoordPair = [number, number];
type TubeLineFeature = TubeLineFeatureCollection["features"][number];

const SEGMENT_PRECISION = 5;
const OFFSET_SPACING_PX = 3.5;

const roundCoord = (value: number) => value.toFixed(SEGMENT_PRECISION);

/** Direction-agnostic key so shared trunk segments match across lines. */
export const segmentKey = (start: CoordPair, end: CoordPair): string => {
  const [first, second] =
    start[0] < end[0] || (start[0] === end[0] && start[1] <= end[1])
      ? [start, end]
      : [end, start];

  return `${roundCoord(first[0])},${roundCoord(first[1])}|${roundCoord(second[0])},${roundCoord(second[1])}`;
};

const pushOffsetRun = (
  output: TubeLineFeature[],
  feature: TubeLineFeature,
  coordinates: CoordPair[],
  lineOffset: number,
  runIndex: number,
) => {
  if (coordinates.length < 2) return;

  const featureId = `${feature.properties.featureId}-${runIndex}`;

  output.push({
    type: "Feature",
    id: featureId,
    properties: {
      ...feature.properties,
      featureId,
      lineOffset,
    },
    geometry: {
      type: "LineString",
      coordinates,
    },
  });
};

/** Split overlapping segments onto parallel offsets perpendicular to the line. */
export const applyTubeLineOffsets = (
  features: TubeLineFeature[],
): TubeLineFeature[] => {
  const segmentLines = new Map<string, Set<string>>();

  for (const feature of features) {
    const { coordinates } = feature.geometry;

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const key = segmentKey(coordinates[index], coordinates[index + 1]);
      const lineIds = segmentLines.get(key) ?? new Set<string>();
      lineIds.add(feature.properties.lineId);
      segmentLines.set(key, lineIds);
    }
  }

  const segmentOffsets = new Map<string, Map<string, number>>();

  for (const [key, lineIds] of segmentLines) {
    if (lineIds.size < 2) continue;

    const sortedLineIds = [...lineIds].sort();
    const offsets = new Map<string, number>();

    sortedLineIds.forEach((lineId, index) => {
      offsets.set(
        lineId,
        (index - (sortedLineIds.length - 1) / 2) * OFFSET_SPACING_PX,
      );
    });

    segmentOffsets.set(key, offsets);
  }

  const offsetForSegment = (lineId: string, start: CoordPair, end: CoordPair) =>
    segmentOffsets.get(segmentKey(start, end))?.get(lineId) ?? 0;

  const output: TubeLineFeature[] = [];

  for (const feature of features) {
    const { coordinates } = feature.geometry;
    if (coordinates.length < 2) continue;

    let runStart = 0;
    let runOffset = offsetForSegment(
      feature.properties.lineId,
      coordinates[0],
      coordinates[1],
    );

    for (let index = 1; index < coordinates.length - 1; index += 1) {
      const nextOffset = offsetForSegment(
        feature.properties.lineId,
        coordinates[index],
        coordinates[index + 1],
      );

      if (nextOffset !== runOffset) {
        pushOffsetRun(
          output,
          feature,
          coordinates.slice(runStart, index + 1),
          runOffset,
          runStart,
        );
        runStart = index;
        runOffset = nextOffset;
      }
    }

    pushOffsetRun(
      output,
      feature,
      coordinates.slice(runStart),
      runOffset,
      runStart,
    );
  }

  return output;
};

export const withTubeLineOffsets = (
  collection: TubeLineFeatureCollection,
): TubeLineFeatureCollection => {
  const features = applyTubeLineOffsets(collection.features);

  return {
    ...collection,
    features,
    meta: collection.meta
      ? { ...collection.meta, featureCount: features.length }
      : undefined,
  };
};
