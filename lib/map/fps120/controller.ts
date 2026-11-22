import type { Map as MapLibreMap } from "maplibre-gl"

import { nextSampleDelay } from "@/lib/map/fps120/flag"

/**
 * Input-only 120 Hz pilot for iOS Safari, after
 * rida.dev/blog/bypassing-ios-safari-60-fps-limit.
 *
 * WebKit holds touch events and rAF to 60 Hz, but native scrolling runs on
 * the compositor at the panel's rate. So a transparent scroller (the
 * "controller") sits over the map canvas, under markers. One finger scrolls
 * it natively, momentum included; a MessageChannel + setTimeout loop,
 * phase-locked to rAF timestamps, reads scrollLeft/scrollTop on a 120 Hz grid
 * and pans the map by the difference. An empty rAF loop makes Safari flush
 * scroll positions every tick, and a tiny smooth-scrolling element keeps
 * ProMotion at 120 Hz. All of it runs only while a finger is down or the
 * scroller is still moving.
 *
 * scrollLeft/Top are integers, so the scroller is DPR times larger and scaled
 * back down: one unit is one device pixel instead of one CSS pixel.
 *
 * Two-finger gestures (pinch, rotate) fall through to MapLibre's own touch
 * handlers; the controller ignores scroll while they run. Taps reach MapLibre
 * as the click iOS synthesises on the controller (it lives inside the
 * canvas container). Long-press and double-tap zoom are re-done here because
 * single-finger touches no longer reach MapLibre or useMapLongPress.
 */

export const fps120Stats = { samples: 0, unique: 0, touchMoves: 0, active: false }

const SPAN = 60_000
const INTERVAL = 1000 / 120
const IDLE_MS = 160
const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_PX = 30

const STYLE_ID = "fps120-controller-style"

const ensureStyle = () => {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent =
    ".fps120-scroller{scrollbar-width:none}.fps120-scroller::-webkit-scrollbar{display:none}"
  document.head.append(style)
}

export type Fps120Options = {
  onLongPress: (point: { latitude: number; longitude: number }) => void
}

export const attachFps120Controller = (map: MapLibreMap, options: Fps120Options) => {
  ensureStyle()
  // The canvas container has no height of its own; size from the map element.
  const container = map.getContainer()
  const canvas = map.getCanvas()

  const wrapper = document.createElement("div")
  wrapper.dataset.fps120 = "controller"
  Object.assign(wrapper.style, { position: "absolute", inset: "0", overflow: "hidden" })
  const scroller = document.createElement("div")
  scroller.className = "fps120-scroller"
  Object.assign(scroller.style, {
    position: "absolute",
    left: "0",
    top: "0",
    overflow: "scroll",
    touchAction: "pan-x pan-y",
    overscrollBehavior: "none",
    transformOrigin: "0 0",
    background: "transparent",
  } satisfies Partial<CSSStyleDeclaration>)
  scroller.style.setProperty("-webkit-tap-highlight-color", "transparent")
  const content = document.createElement("div")
  scroller.append(content)
  wrapper.append(scroller)
  // Right after the canvas: markers and popups come later in the DOM, so they stay on top.
  canvas.after(wrapper)

  // ProMotion keep-alive: a tiny invisible scroller that smooth-scrolls while we are active.
  const keepAlive = document.createElement("div")
  Object.assign(keepAlive.style, {
    position: "fixed",
    left: "0",
    bottom: "0",
    width: "2px",
    height: "2px",
    overflow: "scroll",
    opacity: "0.01",
    pointerEvents: "none",
    zIndex: "-1",
  })
  const keepAliveContent = document.createElement("div")
  keepAliveContent.style.height = "4000px"
  keepAlive.append(keepAliveContent)
  document.body.append(keepAlive)

  let dpr = 1
  let lastX = 0
  let lastY = 0
  const layout = () => {
    dpr = window.devicePixelRatio || 1
    const w = container.clientWidth * dpr
    const h = container.clientHeight * dpr
    Object.assign(scroller.style, {
      width: `${w}px`,
      height: `${h}px`,
      transform: `scale(${1 / dpr})`,
    })
    content.style.width = `${w + 2 * SPAN}px`
    content.style.height = `${h + 2 * SPAN}px`
  }
  const recentre = () => {
    scroller.scrollLeft = SPAN
    scroller.scrollTop = SPAN
    lastX = scroller.scrollLeft
    lastY = scroller.scrollTop
  }
  layout()
  recentre()

  let active = false
  let touching = false
  let multi = false
  let frozen = false
  let lastFrame = performance.now()
  let lastChange = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let keepAliveId: ReturnType<typeof setInterval> | null = null
  let keepAliveFlip = false

  const channel = new MessageChannel()

  const frame = (ts: number) => {
    lastFrame = ts
    if (active) requestAnimationFrame(frame)
  }

  const deactivate = () => {
    active = false
    fps120Stats.active = false
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = null
    if (keepAliveId !== null) clearInterval(keepAliveId)
    keepAliveId = null
    frozen = false
    recentre()
  }

  const tick = () => {
    timeoutId = null
    if (!active) return
    const now = performance.now()
    const sx = scroller.scrollLeft
    const sy = scroller.scrollTop
    fps120Stats.samples += 1
    if (sx !== lastX || sy !== lastY) {
      fps120Stats.unique += 1
      const dx = (sx - lastX) / dpr
      const dy = (sy - lastY) / dpr
      lastX = sx
      lastY = sy
      lastChange = now
      if (!frozen && !multi) {
        const centre = map.project(map.getCenter())
        map.jumpTo({ center: map.unproject([centre.x + dx, centre.y + dy]) })
      }
    }
    if (!touching && now - lastChange > IDLE_MS) {
      deactivate()
      return
    }
    timeoutId = setTimeout(() => channel.port2.postMessage(0), nextSampleDelay(now, lastFrame, INTERVAL))
  }
  channel.port1.onmessage = tick

  const activate = () => {
    lastChange = performance.now()
    if (active) return
    active = true
    fps120Stats.active = true
    requestAnimationFrame(frame)
    channel.port2.postMessage(0)
    keepAliveId = setInterval(() => {
      keepAliveFlip = !keepAliveFlip
      keepAlive.scrollTo({ top: keepAliveFlip ? 3000 : 0, behavior: "smooth" })
    }, 250)
  }

  // Native momentum after the finger lifts also arrives as scroll.
  const handleScroll = () => {
    if (!active) activate()
  }

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let startT = 0
  let moved = 0
  let lastTap: { t: number; x: number; y: number } | null = null
  const clearPress = () => {
    if (pressTimer !== null) clearTimeout(pressTimer)
    pressTimer = null
  }
  const toLngLat = (x: number, y: number) => {
    const rect = container.getBoundingClientRect()
    return map.unproject([x - rect.left, y - rect.top])
  }

  const handleTouchStart = (event: TouchEvent) => {
    fps120Stats.touchMoves += 1
    if (multi || event.touches.length > 1) {
      // Second finger: hand the gesture to MapLibre (pinch zoom, rotate).
      multi = true
      frozen = true
      clearPress()
      return
    }
    event.stopPropagation()
    touching = true
    const t = event.touches[0]
    startX = t.clientX
    startY = t.clientY
    startT = performance.now()
    moved = 0
    activate()
    clearPress()
    pressTimer = setTimeout(() => {
      pressTimer = null
      const point = toLngLat(startX, startY)
      navigator.vibrate?.(10)
      options.onLongPress({ latitude: point.lat, longitude: point.lng })
    }, LONG_PRESS_MS)
  }

  const handleTouchMove = (event: TouchEvent) => {
    fps120Stats.touchMoves += 1
    if (multi) return
    event.stopPropagation()
    const t = event.touches[0]
    if (!t) return
    moved = Math.max(moved, Math.hypot(t.clientX - startX, t.clientY - startY))
    if (moved > MOVE_CANCEL_PX) clearPress()
  }

  const handleTouchEnd = (event: TouchEvent) => {
    if (multi) {
      if (event.touches.length === 0) {
        multi = false
        touching = false
        // Ignore whatever the two-finger scroll did until the controller settles.
        lastChange = performance.now()
      }
      return
    }
    event.stopPropagation()
    touching = event.touches.length > 0
    const wasPress = pressTimer !== null
    clearPress()
    const now = performance.now()
    if (wasPress && moved <= MOVE_CANCEL_PX && now - startT < DOUBLE_TAP_MS) {
      if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(startX - lastTap.x, startY - lastTap.y) < DOUBLE_TAP_PX) {
        lastTap = null
        map.easeTo({ zoom: map.getZoom() + 1, around: toLngLat(startX, startY), duration: 250 })
      } else {
        lastTap = { t: now, x: startX, y: startY }
      }
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    layout()
    if (!active) recentre()
  })
  resizeObserver.observe(container)

  scroller.addEventListener("scroll", handleScroll, { passive: true })
  scroller.addEventListener("touchstart", handleTouchStart, { passive: true })
  scroller.addEventListener("touchmove", handleTouchMove, { passive: true })
  scroller.addEventListener("touchend", handleTouchEnd, { passive: true })
  scroller.addEventListener("touchcancel", handleTouchEnd, { passive: true })

  return () => {
    deactivate()
    clearPress()
    resizeObserver.disconnect()
    channel.port1.onmessage = null
    channel.port1.close()
    wrapper.remove()
    keepAlive.remove()
  }
}
