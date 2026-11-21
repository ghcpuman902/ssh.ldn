import { createNoiseGridReader } from "@/lib/map/noise-cell-reader"
import {
  NOISE_DATA_BASE_URL,
  energySumDb,
  localLayerName,
  roadLocalLayerName,
  type LocalNoiseSlot,
} from "@/lib/map/noise-tiles"

const SLOTS: LocalNoiseSlot[] = [
  "weekday-day",
  "weekday-night",
  "weekend-day",
  "weekend-night",
]

export type LocalLevel = {
  /** Local sources alone, dB (0.5 dB steps); null under 35 dB. */
  db: number | null
  /** DEFRA road band the map draws with local sources on (road + local energy). */
  roadBand: number
}

export type LocalLevels = Record<LocalNoiseSlot, LocalLevel>

let reader: ReturnType<typeof createNoiseGridReader> | null = null

/**
 * The local-sources values of the cell under a point, for every slot, from
 * the same grid chunks the map draws (lib/map/noise-tiles.ts). Null with no
 * bake or outside the grid.
 */
export const fetchLocalLevels = async (
  latitude: number,
  longitude: number
): Promise<LocalLevels | null> => {
  if (!NOISE_DATA_BASE_URL) return null
  reader ??= createNoiseGridReader(`${NOISE_DATA_BASE_URL}/grid`)
  const r = reader
  const entries = await Promise.all(
    SLOTS.map(async (slot) => {
      const [code, roadBand] = await Promise.all([
        r.valueAt(latitude, longitude, localLayerName(slot)),
        r.valueAt(latitude, longitude, roadLocalLayerName(slot)),
      ])
      if (code === null || roadBand === null) return null
      return [slot, { db: code > 0 ? code / 2 : null, roadBand }] as const
    })
  )
  if (entries.some((e) => e === null)) return null
  return Object.fromEntries(
    entries as Array<readonly [LocalNoiseSlot, LocalLevel]>
  ) as LocalLevels
}

/** Road + local sources as energy, dB; null when both are empty. */
export const roadPlusLocalDb = (
  roadDb: number | null,
  localDb: number | null
) => energySumDb(roadDb, localDb)
