type CoordPair = [number, number];

export const stripStationLabel = (name: string | null | undefined) => {
  if (!name) return null;

  return name
    .replace(/ Underground Station$/i, "")
    .replace(/ Rail Station$/i, "")
    .replace(/ DLR Station$/i, "")
    .replace(/ Station$/i, "")
    .trim();
};

const isCoordPair = (value: unknown): value is CoordPair =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number";

const isLineStringCoords = (value: unknown): value is CoordPair[] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  value.every(isCoordPair);

/** TfL lineStrings are GeoJSON LineStrings or nested coordinate arrays. */
export const parseLineStringEntries = (value: string): CoordPair[][] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as { type?: string }).type === "LineString" &&
      "coordinates" in parsed &&
      isLineStringCoords((parsed as { coordinates: unknown }).coordinates)
    ) {
      return [(parsed as { coordinates: CoordPair[] }).coordinates];
    }

    if (isLineStringCoords(parsed)) {
      return [parsed];
    }

    if (Array.isArray(parsed) && parsed.every(isLineStringCoords)) {
      return parsed;
    }

    return [];
  } catch {
    return [];
  }
};

/** Drop consecutive duplicate vertices from dense TfL polylines. */
export const dedupeConsecutiveCoords = (coordinates: CoordPair[]): CoordPair[] => {
  if (coordinates.length < 2) return coordinates;

  const deduped: CoordPair[] = [coordinates[0]];

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = deduped[deduped.length - 1];
    const current = coordinates[index];

    if (
      Math.abs(previous[0] - current[0]) < 1e-6 &&
      Math.abs(previous[1] - current[1]) < 1e-6
    ) {
      continue;
    }

    deduped.push(current);
  }

  return deduped;
};
