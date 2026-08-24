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

const DRAG_THRESHOLD_PX = 8
const DISMISS_OVERDRAG_PX = 72
const OVERDRAG_RESISTANCE = 0.38

const getViewportHeight = () =>
  window.visualViewport?.height ?? window.innerHeight

const getRootFontSizePx = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

const getSnapHeights = (): AnalyseSheetSnapHeights =>
  getAnalyseSheetSnapHeights(getViewportHeight(), getRootFontSizePx())

const isSheetChromeDragExempt = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false

  return Boolean(target.closest("[role='listbox'], [data-sheet-no-drag]"))
}

const applySheetHeight = (
  nextHeight: number,
  heights: AnalyseSheetSnapHeights
) => {
  if (nextHeight >= heights.peek) {
    return clampAnalyseSheetHeight(nextHeight, heights)
  }

  return heights.peek - (heights.peek - nextHeight) * OVERDRAG_RESISTANCE
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
  const [snap, setSnap] = useState<AnalyseSheetSnap>("half")
  const [heights, setHeights] = useState<AnalyseSheetSnapHeights>(() =>
    getAnalyseSheetSnapHeights(800, 16)
  )
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startHeight: number
    lastY: number
    lastTime: number
    velocity: number
    active: boolean
    captureTarget: HTMLElement
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

  useEffect(() => {
    if (!open) return

    const html = document.documentElement
    const body = document.body
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    }

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    html.style.overscrollBehavior = "none"
    body.style.overscrollBehavior = "none"

    return () => {
      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      html.style.overscrollBehavior = previous.htmlOverscroll
      body.style.overscrollBehavior = previous.bodyOverscroll
    }
  }, [open])

  const handleSearchFocus = useCallback(() => {
    setSnap((current) => (current === "full" ? current : "half"))
  }, [])

  const beginDrag = (
    event: PointerEvent<HTMLElement>,
    options: { immediate: boolean }
  ) => {
    if (event.button !== 0) return
    if (!options.immediate && isSheetChromeDragExempt(event.target)) return

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: sheetHeight,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      active: options.immediate,
      captureTarget: event.currentTarget,
    }

    if (options.immediate) {
      setDragHeight(sheetHeight)
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    }
  }

  const handleHandlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    beginDrag(event, { immediate: true })
  }

  const handleChromePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    beginDrag(event, { immediate: false })
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (!drag.active) {
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY

      if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) return
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        dragRef.current = null
        return
      }

      drag.active = true
      setDragHeight(drag.startHeight)
      drag.captureTarget.setPointerCapture(event.pointerId)

      if (event.target instanceof HTMLElement) {
        event.target.blur()
      }
    }

    const now = performance.now()
    const elapsed = now - drag.lastTime
    const nextHeight = applySheetHeight(
      drag.startHeight + (drag.startY - event.clientY),
      heights
    )

    if (elapsed > 0) {
      drag.velocity = (event.clientY - drag.lastY) / elapsed
    }
    drag.lastY = event.clientY
    drag.lastTime = now
    setDragHeight(nextHeight)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const wasActive = drag.active
    const releaseHeight = dragHeight ?? drag.startHeight
    dragRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (!wasActive) return

    if (
      releaseHeight < heights.peek - 8 &&
      (drag.velocity > 0.25 || releaseHeight < heights.peek - DISMISS_OVERDRAG_PX)
    ) {
      setDragHeight(null)
      onClose()
      return
    }

    const nextSnap = resolveAnalyseSheetReleaseSnap({
      height: Math.max(releaseHeight, heights.peek),
      velocityPxPerMs: drag.velocity,
      heights,
    })

    setSnap(nextSnap)
    setDragHeight(null)
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
          "pointer-events-auto flex flex-col overflow-hidden overscroll-none rounded-t-4xl border border-border/60 bg-background",
          !isDragging && "transition-[height] duration-300 ease-out"
        )}
        style={{ height: sheetHeight }}
        onWheel={(event) => event.stopPropagation()}
      >
        <div
          className={cn("shrink-0", isDragging && "select-none")}
          onPointerDown={handleChromePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <button
            type="button"
            aria-label="Resize analysis panel"
            aria-valuetext={SNAP_LABEL[snap]}
            className="flex h-7 w-full touch-none items-center justify-center"
            onPointerDown={handleHandlePointerDown}
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
            Drag the handle, search bar, or header to resize. Close with the
            dismiss control to leave analysis.
          </p>

          <div
            className="relative z-10 px-3 pb-2"
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
            <AnalyseHeader
              state={state}
              onClose={onClose}
              primaryBorough={primaryBorough}
              className="touch-none border-border/60"
            />
          ) : null}
        </div>

        {isAnalysing ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <AnalyseBody
              state={state}
              primaryBorough={primaryBorough}
              focusedNoisyPoiId={focusedNoisyPoiId}
              onNoisyPoiHover={onNoisyPoiHover}
              onNoisyPoiFocus={onNoisyPoiFocus}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
