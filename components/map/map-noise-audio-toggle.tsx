"use client"

import { Volume2, VolumeX } from "lucide-react"

import {
  NOISE_AUDIO_CHANNEL_IDS,
  NOISE_AUDIO_CHANNELS,
  type NoiseAudioChannelLevels,
} from "@/lib/map/noise-audio-map"
import { cn } from "@/lib/utils"

type MapNoiseAudioToggleProps = {
  enabled: boolean
  mixPercentages: NoiseAudioChannelLevels
  onEnabledChange: (enabled: boolean) => void
  mode?: "cursor" | "center"
}

const activeMixItems = (mixPercentages: NoiseAudioChannelLevels) =>
  NOISE_AUDIO_CHANNEL_IDS.map((id) => ({
    id,
    label: NOISE_AUDIO_CHANNELS[id].label,
    percentage: Math.round(mixPercentages[id]),
  })).filter((item) => item.percentage > 0)

const MixBars = ({
  items,
}: {
  items: ReturnType<typeof activeMixItems>
}) => (
  <div className="flex h-full items-center gap-2.5 overflow-hidden px-3">
    {items.slice(0, 4).map((item) => (
      <div
        key={item.id}
        className="flex w-14 shrink-0 flex-col justify-center gap-0.5"
      >
        <span
          className="truncate text-[0.625rem] leading-none text-muted-foreground"
          title={item.label}
        >
          {item.label}
        </span>
        <span
          aria-hidden="true"
          className="h-1 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${item.percentage}%` }}
          />
        </span>
        <span className="sr-only">
          {item.label} {item.percentage} percent
        </span>
      </div>
    ))}
  </div>
)

export const MapNoiseAudioToggle = ({
  enabled,
  mixPercentages,
  onEnabledChange,
  mode = "cursor",
}: MapNoiseAudioToggleProps) => {
  const items = activeMixItems(mixPercentages)
  const expanded = enabled

  const handleClick = () => {
    onEnabledChange(!enabled)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return

    event.preventDefault()
    handleClick()
  }

  const statusText = enabled
    ? mode === "center"
      ? "Pan the map under the crosshair."
      : "Move over visible noise layers."
    : mode === "center"
      ? "Tap to hear the centre point."
      : "Click to hear cursor-point noise."

  const showMixBars = enabled && items.length > 0

  return (
    <div className="relative w-fit">
      <div
        className={cn(
          "group flex h-11 max-h-11 items-center overflow-hidden rounded-full border border-border/60 bg-white transition-[width] duration-300 ease-out",
          expanded
            ? "w-[min(calc(100vw-2rem),22rem)]"
            : "w-11 hover:w-[min(calc(100vw-2rem),22rem)]"
        )}
      >
        <button
          type="button"
          aria-pressed={enabled}
          aria-label={
            enabled
              ? "Turn representative sound preview off"
              : "Turn representative sound preview on"
          }
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="flex size-11 shrink-0 items-center justify-center text-foreground transition-colors hover:bg-muted/60"
        >
          {enabled ? (
            <Volume2 className="size-4" aria-hidden="true" />
          ) : (
            <VolumeX className="size-4" aria-hidden="true" />
          )}
        </button>

        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden transition-[opacity,width] duration-300 ease-out",
            expanded
              ? "w-auto opacity-100"
              : "w-0 opacity-0 group-hover:w-auto group-hover:opacity-100"
          )}
          aria-live="polite"
        >
          {showMixBars ? (
            <MixBars items={items} />
          ) : (
            <p className="truncate whitespace-nowrap px-4 text-sm text-muted-foreground">
              {statusText}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
