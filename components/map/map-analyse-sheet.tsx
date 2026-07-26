"use client"

import { useEffect, useRef, useState, type Ref } from "react"
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

/** Fully off-screen — selecting this snap means the user dismissed the sheet. */
const SNAP_CLOSED = 0
const SNAP_PEEK = "9.5rem"
const SNAP_HALF = 0.5
const SNAP_FULL = 0.92
const SNAP_POINTS = [SNAP_CLOSED, SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const

const isClosedSnap = (point: number | string | null | undefined) =>
  point === SNAP_CLOSED || point === null

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
  const contentRef = useRef<HTMLDivElement | null>(null)
  const dismissRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const primaryBorough = resolveAnalysePrimaryBorough(state)
  const isAnalysing = state.status === "analysing"

  const handleDismiss = () => {
    if (dismissRef.current) return
    dismissRef.current = true
    setSnap(SNAP_CLOSED)
    onCloseRef.current()
  }

  useEffect(() => {
    if (!open) {
      dismissRef.current = false
      return
    }
    setSnap(SNAP_HALF)
  }, [open])

  const handleSnapChange = (point: number | string | null) => {
    if (isClosedSnap(point)) {
      handleDismiss()
      return
    }
    setSnap(point)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return
    handleDismiss()
  }

  // Vaul with snap points can translate the sheet off-screen on drag without
  // always calling closeDrawer. If it settles mostly below the viewport, treat
  // that as a dismiss so pin + URL clear with the UI.
  useEffect(() => {
    if (!open) return

    const content = contentRef.current
    if (!content) return

    const maybeDismissFromTransform = () => {
      if (dismissRef.current) return

      const transform = getComputedStyle(content).transform
      if (!transform || transform === "none") return

      const match = /matrix(?:3d)?\((.+)\)/.exec(transform)
      if (!match) return

      const parts = match[1].split(",").map((part) => Number(part.trim()))
      const translateY = parts.length === 16 ? parts[13] : parts[5]
      if (!Number.isFinite(translateY)) return

      const height = content.getBoundingClientRect().height || window.innerHeight
      if (translateY > height * 0.85) {
        handleDismiss()
      }
    }

    const handlePointerUp = () => {
      window.requestAnimationFrame(maybeDismissFromTransform)
    }

    content.addEventListener("pointerup", handlePointerUp)
    content.addEventListener("touchend", handlePointerUp)
    content.addEventListener("transitionend", maybeDismissFromTransform)

    return () => {
      content.removeEventListener("pointerup", handlePointerUp)
      content.removeEventListener("touchend", handlePointerUp)
      content.removeEventListener("transitionend", maybeDismissFromTransform)
    }
  }, [open])

  return (
    <Drawer.Root
      open={open}
      onOpenChange={handleOpenChange}
      onClose={handleDismiss}
      onAnimationEnd={(nextOpen) => {
        if (nextOpen) return
        handleDismiss()
      }}
      modal={false}
      dismissible
      snapPoints={[...SNAP_POINTS]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
      snapToSequentialPoint={false}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Content
          ref={contentRef}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex h-[92svh] flex-col outline-none",
            "rounded-t-4xl border border-border/60 bg-background md:hidden"
          )}
        >
          <Drawer.Handle className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-muted" />
          <Drawer.Description className="sr-only">
            Address noise analysis sheet. Drag the handle to expand or collapse.
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
                onClose={handleDismiss}
                primaryBorough={primaryBorough}
                AddressHeading={Drawer.Title}
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
