"use client"

import { ExternalLink, Loader2, X } from "lucide-react"

import { getNoiseContributorMeta } from "@/lib/map/noise-contributor-meta"
import type { GeocodeResult } from "@/lib/server/geocode-types"
import { cn } from "@/lib/utils"

type ScoreContributor = {
  source: string
  weight: number
  score: number
}

type ScoreTimeProfile = {
  day: number
  evening: number
  night: number
}

type ScorePlanningApplication = {
  applicationId: string | null
  reference: string | null
  description: string | null
  status: string | null
  decisionDate: string | null
  distanceMeters: number | null
  planningAuthority: string | null
  url: string
}

type ScoreSummary = {
  noiseScore: number
  noiseBand: string
  confidenceScore: number
  confidenceBand: string
  dominantSources: string[]
  contributors: ScoreContributor[]
  timeProfile: ScoreTimeProfile
  planningApplications: ScorePlanningApplication[]
  caveats: string[]
  recommendedChecks: string[]
}

export type AnalyseState =
  | { status: "idle" }
  | { status: "loading"; address: string }
  | {
      status: "ready"
      address: string
      geocode: GeocodeResult
      score: ScoreSummary | null
      scoreError?: string
    }
  | { status: "error"; address: string; message: string }

type MapAnalysePanelProps = {
  state: AnalyseState
  onClose: () => void
  className?: string
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const TIME_PROFILE_ORDER: [keyof ScoreTimeProfile, string][] = [
  ["day", "Day"],
  ["evening", "Evening"],
  ["night", "Night"],
]

const formatSourceLabel = (source: string) => getNoiseContributorMeta(source).label

export const MapAnalysePanel = ({
  state,
  onClose,
  className,
}: MapAnalysePanelProps) => {
  const isOpen = state.status !== "idle"

  if (!isOpen) {
    return null
  }

  return (
    <aside
      aria-label="Address analysis"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-4xl border border-border/60 bg-white",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Analyse
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
              {state.address}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close analysis panel"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {state.status === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Geocoding and scoring this location…
            </div>
          ) : null}

          {state.status === "error" ? (
            <p className="text-sm text-destructive">{state.message}</p>
          ) : null}

          {state.status === "ready" ? (() => {
            const { score, scoreError } = state

            return (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Located at</p>
                  <p className="text-sm text-foreground">
                    {state.geocode.normalizedAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {state.geocode.latitude.toFixed(5)},{" "}
                    {state.geocode.longitude.toFixed(5)} ·{" "}
                    {state.geocode.coordinatePrecision.replaceAll("_", " ")}
                  </p>
                </div>

                {score ? (
                  <div className="rounded-3xl bg-muted/60 p-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Noise score
                        </p>
                        <p className="text-5xl leading-none font-semibold tracking-tight text-foreground">
                          {score.noiseScore}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-medium text-foreground">
                          {score.noiseBand}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Confidence {score.confidenceScore} ·{" "}
                          {score.confidenceBand}
                        </p>
                      </div>
                    </div>

                    {score.dominantSources.length > 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Top drivers:{" "}
                        {score.dominantSources
                          .map((source) => formatSourceLabel(source))
                          .join(", ")}
                      </p>
                    ) : null}

                    {score.contributors.length > 0 ? (
                      <div className="mt-4 space-y-2.5">
                        {score.contributors.map((contributor) => {
                          const meta = getNoiseContributorMeta(
                            contributor.source
                          )
                          return (
                            <div
                              key={contributor.source}
                              className="flex items-center gap-2.5"
                            >
                              <span
                                className="w-5 shrink-0 text-center text-sm"
                                aria-hidden="true"
                              >
                                {meta.emoji}
                              </span>
                              <p className="w-24 shrink-0 text-xs font-medium text-foreground">
                                {meta.label}
                              </p>
                              <div className="h-3 flex-1 overflow-hidden rounded-full bg-white">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-[width] duration-300 ease-out",
                                    meta.barClassName
                                  )}
                                  style={{
                                    width: `${clampPercent(contributor.score)}%`,
                                  }}
                                />
                              </div>
                              <p className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                                {contributor.score}%
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {TIME_PROFILE_ORDER.map(([key, label]) => (
                        <div key={key} className="rounded-xl bg-white p-2">
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {score.timeProfile[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {scoreError ?? "Score unavailable for this location."}
                  </p>
                )}

                {score && score.planningApplications.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Nearby planning applications
                    </p>
                    <ul className="space-y-1.5">
                      {score.planningApplications.map((application) => (
                        <li key={application.applicationId ?? application.url}>
                          <a
                            href={application.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs transition-colors hover:bg-muted"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 block text-foreground">
                                {application.description ??
                                  application.reference ??
                                  "Planning application"}
                              </span>
                              <span className="mt-0.5 block text-muted-foreground">
                                {[
                                  application.status,
                                  application.distanceMeters !== null
                                    ? `${application.distanceMeters}m away`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <ExternalLink
                              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {score && score.caveats.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Caveats
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {score.caveats.slice(0, 4).map((caveat) => (
                        <li key={caveat}>{caveat}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {score && score.recommendedChecks.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Recommended checks
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {score.recommendedChecks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {state.geocode.warnings.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Notes
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {state.geocode.warnings.slice(0, 2).map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )
          })() : null}
        </div>
      </div>
    </aside>
  )
}
