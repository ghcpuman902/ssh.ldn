"use client"

import { useEffect, useRef } from "react"
import {
  ExternalLink,
  Loader2,
  Martini,
  MoonStar,
  Music2,
  Star,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react"

import { BoroughLogo } from "@/components/map/borough-logo"
import { MapTooltipContent } from "@/components/map/noise-time-grid"
import {
  getPlanningApplicationBadges,
  planningBadgeToneClassName,
} from "@/lib/map/planning-application-meta"
import { resolvePrimaryBorough } from "@/lib/map/borough-meta"
import {
  getNoisyPoiStyle,
  NOISY_POI_SEARCH_RADIUS_METERS,
  PROXIMITY_TIER_LABEL,
  WEEKDAY_INDICES,
  WEEKEND_INDICES,
  type NearbyNoisyPoiSummary,
  type OpeningCoverage,
} from "@/lib/map/google-nearby-noisy-poi"
import { hasGooglePlacesClientKey } from "@/lib/map/google-places"
import { getNoiseContributorMeta } from "@/lib/map/noise-contributor-meta"
import { WEEK_SEGMENT_LETTERS } from "@/lib/map/noise-time"
import type { GeocodeResult } from "@/lib/server/geocode-types"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"
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
  decisionType: string | null
  applicationTypeFull: string | null
  developmentType: string | null
  decisionDate: string | null
  distanceMeters: number | null
  planningAuthority: string | null
  url: string | null
  linkKind: "direct" | "entity" | "portal" | null
}

type ScoreSummary = {
  noiseScore: number
  noiseBand: string
  confidenceScore: number
  confidenceBand: string
  dominantSources: string[]
  contributors: ScoreContributor[]
  timeProfile: ScoreTimeProfile
  caveats: string[]
  recommendedChecks: string[]
}

export type AnalyseTask<T> =
  | { status: "queued" }
  | { status: "running" }
  | { status: "done"; data: T }
  | { status: "failed"; message: string }

export type AnalyseState =
  | { status: "idle" }
  | {
      status: "analysing"
      address: string
      testPointId?: string
      geocode: AnalyseTask<GeocodeResult>
      score: AnalyseTask<ScoreSummary>
      planning: AnalyseTask<ScorePlanningApplication[]>
      noisyPois: AnalyseTask<NearbyNoisyPoiSummary[]>
    }

type MapAnalysePanelProps = {
  state: AnalyseState
  onClose: () => void
  className?: string
  focusedNoisyPoiId?: string | null
  onNoisyPoiHover?: (placeId: string | null) => void
  onNoisyPoiFocus?: (poi: NearbyNoisyPoiSummary) => void
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const TIME_PROFILE_META: {
  key: keyof ScoreTimeProfile
  label: string
  Icon: LucideIcon
  className: string
  iconClassName: string
}[] = [
  {
    key: "day",
    label: "Day",
    Icon: Sun,
    className: "bg-amber-50",
    iconClassName: "text-amber-300/80",
  },
  {
    key: "evening",
    label: "Evening",
    Icon: Martini,
    className: "bg-orange-50",
    iconClassName: "text-orange-300/80",
  },
  {
    key: "night",
    label: "Night",
    Icon: MoonStar,
    className: "bg-indigo-50",
    iconClassName: "text-indigo-300/80",
  },
]

const formatSourceLabel = (source: string) => getNoiseContributorMeta(source).label

/**
 * Poetic, human-readable read of the noise score — mirrors the same score
 * thresholds as `bandFromScore` in `lib/server/score.ts` / `lib/map/client-noise-score.ts`,
 * but trades the clinical band label for language that maps intuitively onto quietness.
 */
const describeNoiseScore = (score: number) => {
  if (score >= 75) {
    return "Rarely a quiet moment"
  }
  if (score >= 55) {
    return "Seldom truly still"
  }
  if (score >= 35) {
    return "A calm hum, most days"
  }
  return "Peacefully quiet"
}

const getPlanningLinkHint = (linkKind: ScorePlanningApplication["linkKind"]) => {
  if (linkKind === "direct") {
    return "Direct link"
  }
  if (linkKind === "portal") {
    return "Council search"
  }
  if (linkKind === "entity") {
    return "National record"
  }
  return null
}

const formatBusinessStatus = (status: string | null) => {
  if (!status || status === "OPERATIONAL") {
    return null
  }

  if (status === "CLOSED_TEMPORARILY") {
    return "Temporarily closed"
  }

  if (status === "CLOSED_PERMANENTLY") {
    return "Permanently closed"
  }

  return status.replaceAll("_", " ").toLowerCase()
}

const renderRating = (rating: number | null, reviewCount: number | null) => {
  if (rating == null) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground">
      <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
      <span className="font-medium tabular-nums">{rating.toFixed(1)}</span>
      {reviewCount != null ? (
        <span className="text-muted-foreground">({reviewCount.toLocaleString()})</span>
      ) : null}
    </span>
  )
}

/** Open = green (weekday) / teal (weekend); closed = muted text grey so the full 12h track reads clearly. */
const COVERAGE_OPEN_WEEKDAY = "#16a34a"
const COVERAGE_OPEN_WEEKEND = "#0d9488"
const COVERAGE_CLOSED = "var(--muted-foreground)"

/** w-1.5 (6px) matches `NoiseTimeGrid`'s bar width so the two widgets read as one family. */
const DAY_BAR_WIDTH_CLASS = "w-1.5"
const DAY_BAR_GAP_CLASS = "gap-[3px]"
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/**
 * Hard-edged bands: bottom = earlier time, top = later time within the block.
 * Grid stacks midnight→midday (top row) above midday→midnight (bottom row) so
 * noon sits in the middle between the two rows.
 */
const buildSteppedGradient = (samples: boolean[], openColor: string) => {
  if (samples.length === 0) {
    return COVERAGE_CLOSED
  }

  const stepPercent = 100 / samples.length
  const stops = samples.flatMap((isOpen, index) => {
    const color = isOpen ? openColor : COVERAGE_CLOSED
    const start = index * stepPercent
    const end = (index + 1) * stepPercent
    return [`${color} ${start}%`, `${color} ${end}%`]
  })

  return `linear-gradient(to top, ${stops.join(", ")})`
}

const DayCoverageBar = ({
  samples,
  dayIndex,
  openColor,
  blockLabel,
  hoursByDay,
}: {
  samples: boolean[]
  dayIndex: number
  openColor: string
  blockLabel: string
  hoursByDay: Partial<Record<number, string>>
}) => {
  const dayLabel = DAY_LABELS[dayIndex]
  const hoursText = hoursByDay[dayIndex] ?? "Hours unavailable"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label={`${dayLabel} ${blockLabel}: ${hoursText}`}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            DAY_BAR_WIDTH_CLASS,
            "pointer-events-auto h-full shrink-0 rounded-sm border-0 p-0"
          )}
          style={{ background: buildSteppedGradient(samples, openColor) }}
        />
      </TooltipTrigger>
      <MapTooltipContent side="top" className="max-w-44 text-center">
        <span className="block font-medium">{dayLabel}</span>
        <span className="block text-muted-foreground">{hoursText}</span>
        <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
          {blockLabel}
        </span>
      </MapTooltipContent>
    </Tooltip>
  )
}

/** One thin vertical bar per calendar day, banded by its own open/closed samples. */
const DayCoverageBars = ({
  samplesByDay,
  dayIndices,
  openColor,
  blockLabel,
  hoursByDay,
  heightClass,
}: {
  samplesByDay: boolean[][]
  dayIndices: number[]
  openColor: string
  blockLabel: string
  hoursByDay: Partial<Record<number, string>>
  heightClass: string
}) => (
  <div className={cn("flex items-stretch", DAY_BAR_GAP_CLASS, heightClass)}>
    {samplesByDay.map((samples, index) => (
      <DayCoverageBar
        key={dayIndices[index]}
        samples={samples}
        dayIndex={dayIndices[index]}
        openColor={openColor}
        blockLabel={blockLabel}
        hoursByDay={hoursByDay}
      />
    ))}
  </div>
)

/** Compact weekday/weekend opening grid — top row midnight→midday, bottom row midday→midnight (noon in the middle). */
const OpeningCoverageGrid = ({ coverage }: { coverage: OpeningCoverage }) => (
  <div
    role="group"
    aria-label="Opening hours by day"
    className="pointer-events-auto mt-1.5 grid w-fit grid-cols-[auto_auto_auto] grid-rows-[auto_auto_auto] items-center gap-x-1.5 gap-y-1"
  >
    <div aria-hidden="true" />
    {(["weekday", "weekend"] as const).map((week) => (
      <p
        key={week}
        className="text-center text-[8px] font-medium leading-none tracking-normal text-muted-foreground"
      >
        {WEEK_SEGMENT_LETTERS[week].replaceAll(" ", "")}
      </p>
    ))}

    <div
      aria-hidden="true"
      className="row-span-2 row-start-2 flex flex-col justify-between self-stretch pr-0.5 text-[9px] font-medium leading-none text-muted-foreground"
    >
      <span>12am</span>
      <span>noon</span>
      <span>12am</span>
    </div>

    <DayCoverageBars
      samplesByDay={coverage.weekdayMidnight}
      dayIndices={WEEKDAY_INDICES}
      openColor={COVERAGE_OPEN_WEEKDAY}
      blockLabel="midnight → midday"
      hoursByDay={coverage.hoursByDay}
      heightClass="h-3.5"
    />
    <DayCoverageBars
      samplesByDay={coverage.weekendMidnight}
      dayIndices={WEEKEND_INDICES}
      openColor={COVERAGE_OPEN_WEEKEND}
      blockLabel="midnight → midday"
      hoursByDay={coverage.hoursByDay}
      heightClass="h-3.5"
    />

    <DayCoverageBars
      samplesByDay={coverage.weekdayMidday}
      dayIndices={WEEKDAY_INDICES}
      openColor={COVERAGE_OPEN_WEEKDAY}
      blockLabel="midday → midnight"
      hoursByDay={coverage.hoursByDay}
      heightClass="h-3.5"
    />
    <DayCoverageBars
      samplesByDay={coverage.weekendMidday}
      dayIndices={WEEKEND_INDICES}
      openColor={COVERAGE_OPEN_WEEKEND}
      blockLabel="midday → midnight"
      hoursByDay={coverage.hoursByDay}
      heightClass="h-3.5"
    />
  </div>
)

const NoisyPoiCard = ({
  poi,
  index,
  isFocused,
  onHover,
  onFocus,
}: {
  poi: NearbyNoisyPoiSummary
  index: number
  isFocused: boolean
  onHover: (placeId: string | null) => void
  onFocus: (poi: NearbyNoisyPoiSummary) => void
}) => {
  const businessStatus = formatBusinessStatus(poi.businessStatus)
  const style = getNoisyPoiStyle(poi.primaryType, poi.categoryLabel)
  const metaLine = [`${poi.distanceMeters}m`, businessStatus]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      data-poi-id={poi.placeId}
      className={cn(
        "relative w-44 shrink-0 scroll-ml-4 snap-start rounded-2xl border bg-muted/60 text-xs transition-[transform,border-color] duration-150 ease-out",
        "has-active:scale-98",
        isFocused ? "border-primary" : "border-border/60 hover:border-border"
      )}
    >
      <button
        type="button"
        onMouseEnter={() => onHover(poi.placeId)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(poi.placeId)}
        onBlur={() => onHover(null)}
        onClick={() => onFocus(poi)}
        aria-pressed={isFocused}
        aria-label={`Highlight ${poi.name} on the map, ${poi.distanceMeters}m away`}
        className="absolute inset-0 z-0 rounded-2xl text-left"
      />

      <div className="pointer-events-none relative z-1">
        <span className="relative block aspect-4/3 w-full overflow-hidden rounded-t-2xl bg-muted">
          {poi.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Google Places photo, not worth Next/Image config
            <img
              src={poi.photoUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center text-2xl"
              style={{ backgroundColor: `color-mix(in oklch, ${style.color} 18%, white)` }}
            >
              {style.emoji}
            </span>
          )}
          <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center">
            {isFocused ? (
              <span
                aria-hidden="true"
                className="motion-safe:animate-ping absolute inset-0 rounded-full opacity-75"
                style={{ backgroundColor: style.color }}
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative flex size-5 items-center justify-center rounded-full border border-white/70 text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: style.color }}
            >
              {index + 1}
            </span>
          </span>
          {poi.googleMapsUrl ? (
            <a
              href={poi.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${poi.name} on Google Maps`}
              className="pointer-events-auto absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
            >
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </span>

        <span className="block px-2.5 py-2">
          <span className="block truncate font-medium text-foreground">
            {poi.name}
          </span>
          <span className="mt-0.5 block truncate text-muted-foreground">
            {style.emoji} {poi.categoryLabel} · {metaLine}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {renderRating(poi.rating, poi.reviewCount)}
            {poi.hasLiveMusic ? (
              <Music2
                className="size-3 text-muted-foreground"
                aria-label="Live music"
              />
            ) : null}
          </span>
          {poi.openingCoverage ? (
            <OpeningCoverageGrid coverage={poi.openingCoverage} />
          ) : null}
          {poi.reviewSnippet ? (
            <span className="mt-1.5 block line-clamp-2 text-muted-foreground italic">
              “{poi.reviewSnippet}”
            </span>
          ) : null}
        </span>
      </div>
    </div>
  )
}

const renderPlanningApplication = (application: ScorePlanningApplication) => {
  const badges = getPlanningApplicationBadges({
    status: application.status,
    decisionType: application.decisionType,
    applicationTypeFull: application.applicationTypeFull,
    developmentType: application.developmentType,
    description: application.description,
  })
  const linkHint = getPlanningLinkHint(application.linkKind)
  const metaLine = [
    application.distanceMeters !== null
      ? `${application.distanceMeters}m away`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const linkLabel = application.reference
    ? `Open planning application ${application.reference}${application.planningAuthority ? ` on ${application.planningAuthority}` : ""}`
    : `Open planning application${application.planningAuthority ? ` on ${application.planningAuthority}` : ""}`

  const cardContent = (
    <>
      <span className="min-w-0 flex-1 pr-8">
        {application.reference ? (
          <span className="block font-medium text-foreground">
            {application.reference}
          </span>
        ) : null}
        <span
          className={cn(
            "block text-foreground",
            application.reference ? "mt-0.5 line-clamp-2" : "line-clamp-2"
          )}
        >
          {application.description ??
            application.reference ??
            "Planning application"}
        </span>
        {badges.length > 0 || linkHint ? (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {badges.map((badge) => (
              <span
                key={`${application.applicationId ?? application.reference}-${badge.key}-${badge.label}`}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  planningBadgeToneClassName(badge.tone)
                )}
              >
                {badge.label}
              </span>
            ))}
            {linkHint ? (
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {linkHint}
              </span>
            ) : null}
          </span>
        ) : null}
        {metaLine ? (
          <span className="mt-1 block text-muted-foreground">{metaLine}</span>
        ) : null}
      </span>
      <BoroughLogo
        planningAuthority={application.planningAuthority}
        size="xs"
        className="absolute right-2 bottom-2"
      />
      {application.url ? (
        <ExternalLink
          className="absolute top-2 right-2 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </>
  )

  if (!application.url) {
    return (
      <li
        key={
          application.applicationId ??
          application.reference ??
          application.description
        }
        className="relative rounded-xl bg-muted/60 px-3 py-2 pb-7 text-xs"
      >
        {cardContent}
      </li>
    )
  }

  return (
    <li key={application.applicationId ?? application.url}>
      <a
        href={application.url}
        target="_blank"
        rel="noreferrer"
        aria-label={linkLabel}
        className="relative block rounded-xl bg-muted/60 px-3 py-2 pb-7 text-xs transition-colors hover:bg-muted"
      >
        {cardContent}
      </a>
    </li>
  )
}

export const MapAnalysePanel = ({
  state,
  onClose,
  className,
  focusedNoisyPoiId = null,
  onNoisyPoiHover,
  onNoisyPoiFocus,
}: MapAnalysePanelProps) => {
  const isOpen = state.status !== "idle"
  const primaryBorough =
    state.status === "analysing" &&
    state.planning.status === "done" &&
    state.planning.data.length > 0
      ? resolvePrimaryBorough(
          state.planning.data.map((application) => application.planningAuthority)
        )
      : null
  const noisyPoiScrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focusedNoisyPoiId) return

    const scroller = noisyPoiScrollerRef.current
    const card = scroller?.querySelector<HTMLElement>(
      `[data-poi-id="${focusedNoisyPoiId}"]`
    )
    card?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [focusedNoisyPoiId])

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
        <div className="relative border-b border-border/60 px-4 py-3 pr-12">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Analyse
            </p>
            {state.geocode.status === "done" ? (
              <>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                  {state.geocode.data.normalizedAddress}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {state.geocode.data.latitude.toFixed(5)},{" "}
                  {state.geocode.data.longitude.toFixed(5)} ·{" "}
                  {state.geocode.data.coordinatePrecision.replaceAll("_", " ")}
                  {primaryBorough ? ` · ${primaryBorough.name}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                {state.address}
              </p>
            )}
          </div>
          {primaryBorough ? (
            <BoroughLogo
              planningAuthority={primaryBorough.name}
              size="sm"
              className="absolute right-10 bottom-3"
            />
          ) : null}

          <button
            type="button"
            aria-label="Close analysis panel"
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {state.status === "analysing" ? (
            <>
              {state.geocode.status === "running" ||
              state.geocode.status === "queued" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Finding this location…
                </div>
              ) : null}

              {state.geocode.status === "failed" ? (
                <p className="text-sm text-destructive">
                  {state.geocode.message}
                </p>
              ) : null}

              {state.score.status === "queued" ||
              state.score.status === "running" ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Reading noise from the map…
                </div>
              ) : null}

              {state.score.status === "failed" ? (
                <p className="text-sm text-muted-foreground">
                  {state.score.message}
                </p>
              ) : null}

              {state.score.status === "done" ? (() => {
                const score = state.score.data

                return (
                  <>
                    <div className="rounded-3xl bg-muted/60 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Noise score
                          </p>
                          <p className="flex items-baseline gap-0.5 leading-none">
                            <span className="text-5xl font-semibold tracking-tight text-foreground">
                              {score.noiseScore}
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">
                              /100
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-medium text-foreground">
                            {describeNoiseScore(score.noiseScore)}
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
                                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                                    style={{
                                      width: `${clampPercent(contributor.score)}%`,
                                      backgroundColor: meta.strokeColor,
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

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {TIME_PROFILE_META.map(
                          ({ key, label, Icon, className, iconClassName }) => (
                            <div
                              key={key}
                              className={cn(
                                "relative overflow-hidden rounded-xl p-2",
                                className
                              )}
                            >
                              <p className="relative z-10 text-xs text-muted-foreground">
                                {label}
                              </p>
                              <p className="relative z-10 text-sm font-medium tabular-nums text-foreground">
                                {score.timeProfile[key]}
                              </p>
                              <Icon
                                aria-hidden="true"
                                className={cn(
                                  "pointer-events-none absolute -right-2 -bottom-3 size-16",
                                  iconClassName
                                )}
                                strokeWidth={1.25}
                              />
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {score.recommendedChecks.length > 0 ? (
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
                  </>
                )
              })() : null}

              {state.geocode.status === "done" ? (
                <>
                  {state.noisyPois.status === "queued" ||
                  state.noisyPois.status === "running" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      Finding noisy venues on Google…
                    </div>
                  ) : null}

                  {state.noisyPois.status === "failed" ? (
                    <p className="text-xs text-muted-foreground">
                      {state.noisyPois.message}
                    </p>
                  ) : null}

                  {state.noisyPois.status === "done" &&
                  state.noisyPois.data.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Nearby noisy venues · within{" "}
                        {NOISY_POI_SEARCH_RADIUS_METERS}m
                      </p>
                      <div
                        ref={noisyPoiScrollerRef}
                        className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-none"
                      >
                        {state.noisyPois.data.map((poi, index) => (
                          <NoisyPoiCard
                            key={poi.placeId}
                            poi={poi}
                            index={index}
                            isFocused={focusedNoisyPoiId === poi.placeId}
                            onHover={(placeId) => onNoisyPoiHover?.(placeId)}
                            onFocus={(focusedPoi) => onNoisyPoiFocus?.(focusedPoi)}
                          />
                        ))}
                      </div>
                      {focusedNoisyPoiId ? (() => {
                        const focusedPoi = state.noisyPois.data.find(
                          (poi) => poi.placeId === focusedNoisyPoiId
                        )
                        if (!focusedPoi) return null

                        return (
                          <p className="text-xs text-muted-foreground">
                            {PROXIMITY_TIER_LABEL[focusedPoi.proximityTier]} from
                            this address.
                          </p>
                        )
                      })() : null}
                    </div>
                  ) : null}

                  {state.noisyPois.status === "done" &&
                  state.noisyPois.data.length === 0 &&
                  hasGooglePlacesClientKey() ? (
                    <p className="text-xs text-muted-foreground">
                      No bars, clubs, or live venues found within{" "}
                      {NOISY_POI_SEARCH_RADIUS_METERS}m on Google.
                    </p>
                  ) : null}

                  {state.planning.status === "queued" ||
                  state.planning.status === "running" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      Loading nearby planning applications…
                    </div>
                  ) : null}

                  {state.planning.status === "failed" ? (
                    <p className="text-xs text-muted-foreground">
                      {state.planning.message}
                    </p>
                  ) : null}

                  {state.planning.status === "done" &&
                  state.planning.data.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Nearby planning applications
                        {primaryBorough ? ` · ${primaryBorough.name}` : ""}
                      </p>
                      <ul className="space-y-1.5">
                        {state.planning.data.map((application) =>
                          renderPlanningApplication(application)
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {state.planning.status === "done" &&
                  state.planning.data.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No nearby planning applications found within 300m.
                    </p>
                  ) : null}
                </>
              ) : null}

              {state.geocode.status === "done" &&
              state.geocode.data.warnings.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Notes
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {state.geocode.data.warnings.slice(0, 2).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
