"use client"

import type { PublicNoiseFilters, ValueMode } from "@/lib/public-noise/filters"
import type { PublicNoiseSource } from "@/lib/public-noise/colours"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type PublicNoiseFiltersPanelProps = {
  filters: PublicNoiseFilters
  lines: Array<{ id: string; name: string }>
  sources: PublicNoiseSource[]
  years: string[]
  coverageSummary: string
  onChange: (next: PublicNoiseFilters) => void
  onReset: () => void
}

const ALL = "__all__"

export const PublicNoiseFiltersPanel = ({
  filters,
  lines,
  sources,
  years,
  coverageSummary,
  onChange,
  onReset,
}: PublicNoiseFiltersPanelProps) => {
  const handleSelect =
    (key: keyof PublicNoiseFilters) => (value: string | null) => {
      const nextValue = !value || value === ALL ? null : value
      onChange({ ...filters, [key]: nextValue })
    }

  return (
    <section
      aria-label="Map filters"
      className="space-y-3 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {coverageSummary}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Reset filters"
          onClick={onReset}
        >
          Reset
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pn-line">Line</Label>
          <Select
            value={filters.line ?? ALL}
            onValueChange={(v) => handleSelect("line")(v)}
          >
            <SelectTrigger
              id="pn-line"
              className="w-full"
              aria-label="Filter by Tube line"
            >
              <SelectValue placeholder="All lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All lines</SelectItem>
              {lines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {line.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pn-source">Source</Label>
          <Select
            value={filters.source ?? ALL}
            onValueChange={(v) => handleSelect("source")(v)}
          >
            <SelectTrigger
              id="pn-source"
              className="w-full"
              aria-label="Filter by source"
            >
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pn-mode">Value mode</Label>
          <Select
            value={filters.valueMode}
            onValueChange={(v) =>
              onChange({ ...filters, valueMode: (v as ValueMode) || "primary" })
            }
          >
            <SelectTrigger
              id="pn-mode"
              className="w-full"
              aria-label="Value display mode"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="primary">Default (prefer passenger)</SelectItem>
              <SelectItem value="passenger">Passenger only</SelectItem>
              <SelectItem value="cab">Cab / test-vehicle proxy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pn-position">Position</Label>
          <Select
            value={filters.position ?? ALL}
            onValueChange={(v) => handleSelect("position")(v)}
          >
            <SelectTrigger
              id="pn-position"
              className="w-full"
              aria-label="Filter by measurement position"
            >
              <SelectValue placeholder="Any position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any position</SelectItem>
              <SelectItem value="standing">Standing</SelectItem>
              <SelectItem value="seated">Seated</SelectItem>
              <SelectItem value="cab">Cab</SelectItem>
              <SelectItem value="test-vehicle">Test vehicle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pn-year">Year</Label>
          <Select
            value={filters.year ?? ALL}
            onValueChange={(v) => handleSelect("year")(v)}
          >
            <SelectTrigger
              id="pn-year"
              className="w-full"
              aria-label="Filter by year"
            >
              <SelectValue placeholder="Any year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any year</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pn-confidence">Confidence</Label>
          <Select
            value={filters.confidence ?? ALL}
            onValueChange={(v) => handleSelect("confidence")(v)}
          >
            <SelectTrigger
              id="pn-confidence"
              className="w-full"
              aria-label="Filter by confidence tier"
            >
              <SelectValue placeholder="Any tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any tier</SelectItem>
              <SelectItem value="A">Tier A</SelectItem>
              <SelectItem value="B">Tier B</SelectItem>
              <SelectItem value="C">Tier C</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pn-rights">Rights</Label>
          <Select
            value={filters.rights ?? ALL}
            onValueChange={(v) => handleSelect("rights")(v)}
          >
            <SelectTrigger
              id="pn-rights"
              className="w-full"
              aria-label="Filter by data rights"
            >
              <SelectValue placeholder="Any rights" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any rights</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="unknown">Not open data</SelectItem>
              <SelectItem value="restricted">Restricted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="pn-mindb">Min dBA</Label>
          <Input
            id="pn-mindb"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 80"
            value={filters.minDb ?? ""}
            aria-label="Minimum dBA"
            onChange={(event) => {
              const raw = event.target.value
              const n = Number(raw)
              onChange({
                ...filters,
                minDb: raw === "" || !Number.isFinite(n) ? null : n,
              })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pn-maxdb">Max dBA</Label>
          <Input
            id="pn-maxdb"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 100"
            value={filters.maxDb ?? ""}
            aria-label="Maximum dBA"
            onChange={(event) => {
              const raw = event.target.value
              const n = Number(raw)
              onChange({
                ...filters,
                maxDb: raw === "" || !Number.isFinite(n) ? null : n,
              })
            }}
          />
        </div>
      </div>
    </section>
  )
}
