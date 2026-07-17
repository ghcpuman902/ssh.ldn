"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PublicNoiseSegmentProperties } from "@/lib/public-noise/colours"
import type { PublicNoiseSource } from "@/lib/public-noise/colours"
import { colourForDb } from "@/lib/public-noise/colours"
import type { ValueMode } from "@/lib/public-noise/filters"
import { getSegmentDisplayValue } from "@/lib/public-noise/filters"

type PublicNoiseDetailProps = {
  segment: PublicNoiseSegmentProperties | null
  sourcesById: Map<string, PublicNoiseSource>
  valueMode: ValueMode
  onClose: () => void
}

export const PublicNoiseDetail = ({
  segment,
  sourcesById,
  valueMode,
  onClose,
}: PublicNoiseDetailProps) => {
  if (!segment) {
    return (
      <aside
        aria-label="Section details"
        className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground"
      >
        Select a coloured Tube section to see station pair, measurement details,
        provenance, and rights status.
      </aside>
    )
  }

  const value = getSegmentDisplayValue(segment, valueMode)
  const colour = colourForDb(value)

  return (
    <aside
      aria-label={`Details for ${segment.fromStation} to ${segment.toStation}`}
      className="space-y-3 rounded-xl border border-border bg-background/95 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {segment.lineName} line
          </p>
          <h2 className="text-base font-semibold text-foreground">
            {segment.fromStation} → {segment.toStation}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close section details"
          onClick={onClose}
        >
          Close
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-10 rounded-lg border border-border"
          style={{ backgroundColor: colour }}
        />
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {value === null ? "—" : `${value.toFixed(1)}`}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              dBA LAeq
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {segment.observationCount} observation
            {segment.observationCount === 1 ? "" : "s"} ·{" "}
            {segment.dateMin === segment.dateMax
              ? segment.dateMin
              : `${segment.dateMin ?? "?"} – ${segment.dateMax ?? "?"}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">Tier {segment.confidenceTier}</Badge>
        {segment.rights === "unknown" || segment.rights === "restricted" ? (
          <Badge variant="destructive">Not open data / permission required</Badge>
        ) : (
          <Badge variant="outline">Open data</Badge>
        )}
        {segment.hasPassenger ? <Badge variant="outline">Passenger</Badge> : null}
        {segment.hasCab ? <Badge variant="outline">Cab proxy</Badge> : null}
        {segment.geometryFallback ? (
          <Badge variant="outline">Straight-line geometry fallback</Badge>
        ) : null}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Passenger LAeq</dt>
          <dd className="tabular-nums">
            {segment.passengerValueDb === null
              ? "No data"
              : `${segment.passengerValueDb.toFixed(1)} dBA`}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Cab / test LAeq</dt>
          <dd className="tabular-nums">
            {segment.cabValueDb === null
              ? "No data"
              : `${segment.cabValueDb.toFixed(1)} dBA`}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Positions</dt>
          <dd>{segment.positions.join(", ") || "—"}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sources
        </h3>
        <ul className="space-y-2">
          {segment.sourceIds.map((sourceId) => {
            const source = sourcesById.get(sourceId)
            return (
              <li
                key={sourceId}
                className="rounded-lg border border-border bg-muted/30 p-2 text-xs"
              >
                <p className="font-medium text-foreground">
                  {source?.title ?? sourceId}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {source?.rightsLabel ?? "Rights unknown"}
                </p>
                {source?.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-primary underline-offset-2 hover:underline"
                  >
                    Open original source
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Surveys from different dates and measurement positions are not directly
        equivalent. Grey sections have no mapped measurement — that does not
        mean they are quiet. See{" "}
        <Link href="/data-sources" className="underline-offset-2 hover:underline">
          data sources
        </Link>
        .
      </p>
    </aside>
  )
}
