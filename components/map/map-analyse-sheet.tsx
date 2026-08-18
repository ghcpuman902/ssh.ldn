"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react"

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
import {
  clampAnalyseSheetHeight,
  getAnalyseSheetSnapHeights,
  nextAnalyseSheetSnap,
  resolveAnalyseSheetReleaseSnap,
  type AnalyseSheetSnap,
  type AnalyseSheetSnapHeights,
} from "@/lib/map/analyse-sheet-snap"
import { cn } from "@/lib/utils"

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

const SNAP_LABEL: Record<AnalyseSheetSnap, string> = {
  peek: "Peek height",
  half: "Half height",
  full: "Full height",
}

const getViewportHeight = () =>
  window.visualViewport?.height ?? window.innerHeight

const getRootFontSizePx = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

const getSnapHeights = (): AnalyseSheetSnapHeights =>
  getAnalyseSheetSnapHeights(getViewportHeight(), getRootFontSizePx())

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
  const [snap, setSnap] = useState<AnalyseSheetSnap>("half")
  const [heights, setHeights] = useState<AnalyseSheetSnapHeights>(() =>
    getAnalyseSheetSnapHeights(800, 16)
  )
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
    lastY: number
    lastTime: number
    velocity: number
  } | null>(null)

  const primaryBorough = resolveAnalysePrimaryBorough(state)
  const isAnalysing = state.status === "analysing"
  const sheetHeight = dragHeight ?? heights[snap]
  const isDragging = dragHeight !== null

  useEffect(() => {
    if (!open) {
      setDragHeight(null)
      return
    }

    setSnap("half")
    setDragHeight(null)
    setHeights(getSnapHeights())
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleResize = () => {
      setHeights(getSnapHeights())
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    window.visualViewport?.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.visualViewport?.removeEventListener("resize", handleResize)
    }
  }, [open])

  const handleSearchFocus = useCallback(() => {
    setSnap((current) => (current === "full" ? current : "half"))
  }, [])

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    const pointerId = event.pointerId
    const now = performance.now()
    dragRef.current = {
      pointerId,
      startY: event.clientY,
      startHeight: sheetHeight,
      lastY: event.clientY,
      lastTime: now,
      velocity: 0,
    }
    setDragHeight(sheetHeight)
    event.currentTarget.setPointerCapture(pointerId)
    event.preventDefault()
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const now = performance.now()
    const elapsed = now - drag.lastTime
    const deltaFromStart = drag.startY - event.clientY
    const nextHeight = clampAnalyseSheetHeight(
      drag.startHeight + deltaFromStart,
      heights
    )

    if (elapsed > 0) {
      drag.velocity = (event.clientY - drag.lastY) / elapsed
    }
    drag.lastY = event.clientY
    drag.lastTime = now
    setDragHeight(nextHeight)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const nextSnap = resolveAnalyseSheetReleaseSnap({
      height: dragHeight ?? drag.startHeight,
      velocityPxPerMs: drag.velocity,
      heights,
    })

    dragRef.current = null
    setSnap(nextSnap)
    setDragHeight(null)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSnap((current) => nextAnalyseSheetSnap(current, 1))
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSnap((current) => nextAnalyseSheetSnap(current, -1))
      return
    }

    if (event.key === "Home") {
      event.preventDefault()
      setSnap("full")
      return
    }

    if (event.key === "End") {
      event.preventDefault()
      setSnap("peek")
    }
  }

  if (!open) return null

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label="Address analysis"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      <div
        className={cn(
          "pointer-events-auto flex flex-col overflow-hidden rounded-t-4xl border border-border/60 bg-background",
          !isDragging && "transition-[height] duration-300 ease-out"
        )}
        style={{ height: sheetHeight }}
      >
        <button
          type="button"
          aria-label="Resize analysis panel"
          aria-valuetext={SNAP_LABEL[snap]}
          className="flex h-7 w-full shrink-0 touch-none items-center justify-center"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onKeyDown={handleHandleKeyDown}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-12 rounded-full bg-muted"
          />
        </button>

        <p className="sr-only">
          Drag the handle or use arrow keys to resize. Close with the dismiss
          button to leave analysis.
        </p>

        <div
          className="relative z-10 shrink-0 px-3 pb-2"
          onFocusCapture={handleSearchFocus}
        >
          <MapSearchBar
            ref={searchBarRef}
            variant="docked"
            instanceId="mobile-docked"
            {...searchBarProps}
            onExpandedChange={(expanded) => {
              searchBarProps.onExpandedChange?.(expanded)
              if (expanded) {
                handleSearchFocus()
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
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
    </section>
  )
}
