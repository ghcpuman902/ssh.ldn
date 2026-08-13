import {
  ALL_NOISE_ANALYSIS_SLOTS,
  encodeNoiseAnalysisSlot,
  type NoiseAnalysisPart,
  type NoiseAnalysisSlot,
  type NoiseWeekSegment,
} from "@/lib/map/noise-time"
import {
  buildContributors,
  combineLoudness,
  type NoiseScoreByKind,
} from "@/lib/map/noise-score-model"

export type NoiseSlotScoreCell = {
  week: NoiseWeekSegment
  part: NoiseAnalysisPart
  score: number
  dominantSource: string
}

export type TransportScoresByPart = Record<
  NoiseAnalysisPart,
  Omit<NoiseScoreByKind, "nightlife">
>

export type LocalNoiseSlotScores = Record<
  ReturnType<typeof encodeNoiseAnalysisSlot>,
  number
>

export const buildSlotScoreCells = ({
  transportByPart,
  localBySlot,
}: {
  transportByPart: TransportScoresByPart
  localBySlot: LocalNoiseSlotScores
}): NoiseSlotScoreCell[] =>
  ALL_NOISE_ANALYSIS_SLOTS().map((slot) => {
    const scoreByKind: NoiseScoreByKind = {
      ...transportByPart[slot.part],
      nightlife: localBySlot[encodeNoiseAnalysisSlot(slot)] ?? 0,
    }
    const contributors = buildContributors(scoreByKind)

    return {
      ...slot,
      score: Math.round(combineLoudness(scoreByKind)),
      dominantSource: contributors[0]?.source ?? "road",
    }
  })

export const findLoudestSlot = (
  cells: NoiseSlotScoreCell[]
): NoiseSlotScoreCell | null => {
  if (cells.length === 0) return null

  return cells.reduce((loudest, cell) =>
    cell.score > loudest.score ? cell : loudest
  )
}

export const maxScoreForPart = (
  cells: NoiseSlotScoreCell[],
  part: NoiseAnalysisPart
) =>
  Math.max(
    0,
    ...cells.filter((cell) => cell.part === part).map((cell) => cell.score)
  )

export const cellForSlot = (
  cells: NoiseSlotScoreCell[],
  slot: NoiseAnalysisSlot
) =>
  cells.find(
    (cell) => cell.week === slot.week && cell.part === slot.part
  ) ?? {
    ...slot,
    score: 0,
    dominantSource: "road",
  }
