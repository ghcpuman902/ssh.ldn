/**
 * The point API's answer, trimmed to what the report tab shows. Fetched first
 * (DESIGN section 7): our own numbers must not wait for Google.
 */
export type NoiseLevelSource = "road" | "rail" | "airport"
export type NoiseLevelPeriod = "Lden" | "Lday" | "Leve" | "Lnight"

export type NoiseLevels = Record<
  NoiseLevelSource,
  Record<NoiseLevelPeriod, number | null>
> & {
  /**
   * Local sources on the same cell (lib/map/noise-local-levels.ts), per time
   * slot; absent or null with no bake. Kept apart from the DEFRA values above,
   * which are the point API's and never change.
   */
  local?: Record<
    "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night",
    { db: number | null; roadBand: number }
  > | null
}

type PointApiBody = {
  results?: Array<
    Partial<
      Record<
        NoiseLevelSource,
        Partial<Record<NoiseLevelPeriod, { db: number | null } | null>> | null
      >
    >
  >
}

const SOURCES: NoiseLevelSource[] = ["road", "rail", "airport"]
const PERIODS: NoiseLevelPeriod[] = ["Lden", "Lday", "Leve", "Lnight"]

export const parseNoiseLevels = (body: PointApiBody): NoiseLevels | null => {
  const first = body.results?.[0]
  if (!first) return null
  const out = {} as NoiseLevels
  for (const source of SOURCES) {
    out[source] = {} as NoiseLevels[NoiseLevelSource]
    for (const period of PERIODS) {
      out[source][period] = first[source]?.[period]?.db ?? null
    }
  }
  return out
}

export const fetchNoiseLevels = async ({
  latitude,
  longitude,
  signal,
}: {
  latitude: number
  longitude: number
  signal?: AbortSignal
}): Promise<NoiseLevels> => {
  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  })
  const response = await fetch(`/api/noise/point?${params.toString()}`, {
    signal,
  })
  if (!response.ok) throw new Error(`Noise levels unavailable (${response.status})`)
  const levels = parseNoiseLevels((await response.json()) as PointApiBody)
  if (!levels) throw new Error("No noise levels for this point")
  return levels
}
