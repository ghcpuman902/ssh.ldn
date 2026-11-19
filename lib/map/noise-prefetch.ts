/**
 * Idle prefetch of the baked noise tiles (DESIGN section 6: view first, then
 * idle prefetch). Pure logic, no React and no map: `planPrefetch` orders the
 * tiles and `createIdlePrefetcher` runs them politely. The map hook is
 * hooks/use-noise-prefetch.ts.
 *
 * Self-contained on purpose (no imports; the tile layout is passed in) so node --test can load it.
 */
type BakedNoiseKind = "road" | "rail" | "airport"
type BakedNoisePeriod = "day" | "night" | "evening" | "all"

const KINDS: BakedNoiseKind[] = ["road", "rail", "airport"]
const PERIODS: BakedNoisePeriod[] = ["day", "night", "evening", "all"]

/** Coarse levels for all 12 layers (about 2.9 MB), then z13 rings outward from the view. */
export const COARSE_ZOOMS = [8, 9, 10, 11, 12]
export const MAX_CONCURRENT = 2
/** Quiet time with no input before prefetch may start. */
export const IDLE_DELAY_MS = 2000

export type PrefetchBudget = {
  /** z13 ring radii (km), nearest first, that this connection may fetch. */
  ringsKm: number[]
  /** False when the user asked for less data (Save-Data) or the link is 2G. */
  allowed: boolean
}

type NetworkInformationLike = { saveData?: boolean; effectiveType?: string }

/**
 * Chromium exposes Save-Data and effectiveType; Safari exposes neither, so it
 * gets the coarse levels plus a 5 km ring (about 4 MB).
 */
export const prefetchBudget = (
  connection: NetworkInformationLike | undefined
): PrefetchBudget => {
  if (!connection) return { allowed: true, ringsKm: [5] }
  if (connection.saveData) return { allowed: false, ringsKm: [] }
  const type = connection.effectiveType
  if (type === "slow-2g" || type === "2g") return { allowed: false, ringsKm: [] }
  if (type === "3g") return { allowed: true, ringsKm: [5] }
  return { allowed: true, ringsKm: [5, 10, 20] }
}

const tileXY = (lng: number, lat: number, z: number) => {
  const n = 2 ** z
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

const metersPerTile = (z: number, lat: number) =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** z

type Tile = { z: number; x: number; y: number; distKm: number }

/** Every baked tile at zoom z, with its distance from the view centre in km. */
const tilesAtZoom = (
  z: number,
  centre: { lng: number; lat: number },
  bounds: readonly [number, number, number, number]
): Tile[] => {
  const [west, south, east, north] = bounds
  const a = tileXY(west, north, z)
  const b = tileXY(east, south, z)
  const c = tileXY(centre.lng, centre.lat, z)
  const size = metersPerTile(z, centre.lat) / 1000
  const out: Tile[] = []
  for (let x = Math.floor(a.x); x <= Math.floor(b.x); x++) {
    for (let y = Math.floor(a.y); y <= Math.floor(b.y); y++) {
      out.push({ z, x, y, distKm: Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) * size })
    }
  }
  return out.sort((p, q) => p.distKm - q.distKm)
}

export type PrefetchPlanInput = {
  /** Tile URL for one layer and tile (see bakedTileUrl in noise-tiles.ts). */
  urlFor: (
    kind: BakedNoiseKind,
    period: BakedNoisePeriod,
    z: number,
    x: number,
    y: number
  ) => string
  /** West, south, east, north of the baked tiles. */
  bounds: readonly [number, number, number, number]
  /** Zoom of the finest baked tiles (the rings). */
  maxZoom: number
  centre: { lng: number; lat: number }
  budget: PrefetchBudget
  /** Tile URLs to leave out, e.g. ones the view just loaded. */
  skip?: ReadonlySet<string>
}

/**
 * Ordered URLs: coarse zooms first (all 12 layers, nearest tiles first), then
 * z13 rings outward from `centre` (the user's current view, not a fixed
 * point). Empty when the budget says no.
 */
export const planPrefetch = ({ urlFor, bounds, maxZoom, centre, budget, skip }: PrefetchPlanInput) => {
  if (!budget.allowed) return []
  const urls: string[] = []
  const push = (kind: BakedNoiseKind, period: BakedNoisePeriod, t: Tile) => {
    const url = urlFor(kind, period, t.z, t.x, t.y)
    if (!skip?.has(url)) urls.push(url)
  }
  for (const z of COARSE_ZOOMS) {
    for (const t of tilesAtZoom(z, centre, bounds)) {
      for (const kind of KINDS) for (const period of PERIODS) push(kind, period, t)
    }
  }
  const z13 = tilesAtZoom(maxZoom, centre, bounds)
  let from = 0
  for (const km of budget.ringsKm) {
    // A tile belongs to the ring that contains its centre.
    for (const t of z13) {
      if (t.distKm >= from && t.distKm < km) {
        for (const kind of KINDS) for (const period of PERIODS) push(kind, period, t)
      }
    }
    from = km
  }
  return urls
}

export type Scheduler = (task: () => void) => void

type SchedulerGlobal = {
  scheduler?: { postTask?: (cb: () => void, o: { priority: string }) => unknown }
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => unknown
}

/**
 * Background priority where the browser has it (Chrome, Firefox 142+), idle
 * callbacks as the fallback, and a MessageChannel hop in Safari, which has
 * neither.
 */
export const defaultScheduler = (): Scheduler => {
  const g = globalThis as unknown as SchedulerGlobal
  if (g.scheduler?.postTask) {
    return (task) => void g.scheduler!.postTask!(task, { priority: "background" })
  }
  if (g.requestIdleCallback) {
    return (task) => void g.requestIdleCallback!(task, { timeout: 4000 })
  }
  if (typeof MessageChannel !== "undefined") {
    return (task) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => {
        channel.port1.close()
        task()
      }
      channel.port2.postMessage(0)
    }
  }
  return (task) => void setTimeout(task, 50)
}

export type IdlePrefetcher = {
  start: (urls: string[]) => void
  /** Drop the queue and abort in-flight requests at once. */
  abort: () => void
  readonly pending: number
  readonly inFlight: number
}

export type IdlePrefetcherOptions = {
  fetchImpl?: typeof fetch
  schedule?: Scheduler
  maxConcurrent?: number
}

export const createIdlePrefetcher = ({
  fetchImpl = (...args) => fetch(...args),
  schedule = defaultScheduler(),
  maxConcurrent = MAX_CONCURRENT,
}: IdlePrefetcherOptions = {}): IdlePrefetcher => {
  let queue: string[] = []
  let inFlight = 0
  let controller: AbortController | null = null
  let generation = 0

  const pump = (gen: number) => {
    while (gen === generation && inFlight < maxConcurrent && queue.length > 0) {
      const url = queue.shift()!
      inFlight++
      schedule(() => {
        if (gen !== generation) {
          inFlight--
          return
        }
        // Low priority and a plain HTTP cache: the response is stored for
        // MapLibre and the sampler, nothing is read here.
        fetchImpl(url, { priority: "low", signal: controller?.signal } as RequestInit)
          .then((res) => res.arrayBuffer())
          .catch(() => undefined)
          .finally(() => {
            inFlight--
            pump(gen)
          })
      })
    }
  }

  return {
    start: (urls) => {
      generation++
      controller?.abort()
      controller = new AbortController()
      queue = [...urls]
      pump(generation)
    },
    abort: () => {
      generation++
      queue = []
      controller?.abort()
      controller = null
    },
    get pending() {
      return queue.length
    },
    get inFlight() {
      return inFlight
    },
  }
}
