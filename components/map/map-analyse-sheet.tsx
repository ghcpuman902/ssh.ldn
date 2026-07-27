"use client"

import { useEffect, useState, type Ref } from "react"
import { Drawer } from "vaul"

import {
  AnalyseBody,
  AnalyseHeader,
  resolveAnalysePrimaryBorough,
  type AnalyseState,
} from "@/components/map/map-analyse-panel"
import {
  MapSearchBar,
  type MapSearchBarHandle,
  type MapSearchBarProps,
} from "@/components/map/map-search-bar"
import type { NearbyNoisyPoiSummary } from "@/lib/map/google-nearby-noisy-poi"
import { cn } from "@/lib/utils"

const SNAP_PEEK = "9.5rem"
const SNAP_HALF = 0.5
const SNAP_FULL = 0.92
const SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const

type MapAnalyseSheetProps = {
  open: boolean
  state: AnalyseState
  onClose: () => void
  searchBarProps: Omit<MapSearchBarProps, "variant" | "instanceId">
  searchBarRef?: Ref<MapSearchBarHandle>
  focusedNoisyPoiId?: string | null
  onNoisyPoiHover?: (placeId: string | null) => void
  onNoisyPoiFocus?: (poi: NearbyNoisyPoiSummary) => void
}

export const MapAnalyseSheet = ({
  open,
  state,
  onClose,
  searchBarProps,
  searchBarRef,
  focusedNoisyPoiId = null,
  onNoisyPoiHover,
  onNoisyPoiFocus,
}: MapAnalyseSheetProps) => {
  const [snap, setSnap] = useState<number | string | null>(SNAP_HALF)
  const primaryBorough = resolveAnalysePrimaryBorough(state)
  const isAnalysing = state.status === "analysing"

  useEffect(() => {
    if (!open) return
    setSnap(SNAP_HALF)
  }, [open])

  const handleSnapChange = (point: number | string | null) => {
    // Dismiss is close-button only — ignore null / out-of-range snap attempts.
    if (point === null || !SNAP_POINTS.includes(point as (typeof SNAP_POINTS)[number])) {
      return
    }
    setSnap(point)
  }

  return (
    <Drawer.Root
      open={open}
      // Swipe-dismiss is intentionally off; close via the header X only.
      onOpenChange={(nextOpen) => {
        if (nextOpen) return
        // Block Vaul from closing via gesture / escape — keep analyse state.
      }}
      modal={false}
      dismissible={false}
      handleOnly
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
      snapToSequentialPoint
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          // Full-height snap panel would otherwise steal map hits above the
          // visible sheet. Pass events through; only the painted card captures.
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex h-[92svh] flex-col outline-none",
            "md:hidden"
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div
            className={cn(
              "pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden",
              "rounded-t-4xl border border-border/60 bg-background"
            )}
          >
            <Drawer.Handle className="mx-auto mt-2 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
            <Drawer.Title className="sr-only">Address analysis</Drawer.Title>
            <Drawer.Description className="sr-only">
              Drag the handle to resize. Use the close button to dismiss.
            </Drawer.Description>

            <div
              className="shrink-0 px-3 pb-2"
              onFocusCapture={() => setSnap(SNAP_FULL)}
            >
              <MapSearchBar
                ref={searchBarRef}
                variant="docked"
                instanceId="mobile-docked"
                {...searchBarProps}
                onExpandedChange={(expanded) => {
                  searchBarProps.onExpandedChange?.(expanded)
                  if (expanded) {
                    setSnap(SNAP_FULL)
                  }
                }}
              />
            </div>

            {isAnalysing ? (
              <>
                <AnalyseHeader
                  state={state}
                  onClose={onClose}
                  primaryBorough={primaryBorough}
                  className="shrink-0 border-border/60"
                />
                <div
                  data-vaul-no-drag=""
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <AnalyseBody
                    state={state}
                    primaryBorough={primaryBorough}
                    focusedNoisyPoiId={focusedNoisyPoiId}
                    onNoisyPoiHover={onNoisyPoiHover}
                    onNoisyPoiFocus={onNoisyPoiFocus}
                  />
                </div>
              </>
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
