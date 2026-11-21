/**
 * Idle prefetch of the baked noise grid chunks the WebGL layer draws (DESIGN
 * section 6: view first, then idle prefetch). Pure logic, no React and no
 * map: `planPrefetch` orders the chunk files and `createIdlePrefetcher` runs
 * them politely. The map hook is hooks/use-noise-prefetch.ts. The layer
 * fetches the same URLs, so a prefetched chunk comes from the HTTP cache.
 *
 * Self-contained on purpose (no imports; the grid index is passed in) so node --test can load it.
 */

/** Pyramid levels from this one up count as coarse (40 m cells and up): all 12 layers about 4 MB. */
export const COARSE_MIN_LEVEL = 2
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
 * gets the coarse levels plus a 5 km ring of 10 m chunks.
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

/** The parts of `<base>/grid/index.json` the plan needs. */
export type PrefetchGridIndex = {
  cellMeters: number
  chunkCells: number
  levels: Record<string, { cols: number; rows: number }>
  /** layer -> level -> chunk ids that have a file. */
  layers: Record<string, Record<string, number[]>>
}

type Chunk = { level: number; id: number; distKm: number }

/** Every chunk at a level, with its centre's distance from the view centre in km. */
const chunksAtLevel = (index: PrefetchGridIndex, level: number, centre: { col: number; row: number }) => {
  const L = index.levels[String(level)]
  const span = index.chunkCells * 2 ** level
  const km = (span * index.cellMeters) / 1000
  const out: Chunk[] = []
  for (let y = 0; y < L.rows; y++) {
    for (let x = 0; x < L.cols; x++) {
      const d = Math.hypot(x + 0.5 - centre.col / span, y + 0.5 - centre.row / span) * km
      out.push({ level, id: y * L.cols + x, distKm: d })
    }
  }
  return out.sort((p, q) => p.distKm - q.distKm)
}

export type PrefetchPlanInput = {
  /** Chunk URL for one layer, level and chunk id (see gridChunkUrl in noise-grid-gl-math.ts). */
  urlFor: (layer: string, level: number, id: number, cols: number) => string
  index: PrefetchGridIndex
  /** View centre in level-0 grid cells (col east of originE, row south of originN). */
  centre: { col: number; row: number }
  budget: PrefetchBudget
  /** URLs to leave out, e.g. ones the view just loaded. */
  skip?: ReadonlySet<string>
}

/**
 * Ordered URLs: coarse levels first (coarsest first, all 12 layers, nearest
 * chunks first), then rings of 10 m chunks outward from `centre` (the user's
 * current view, not a fixed point). Only chunks that have a file. Empty when
 * the budget says no.
 */
export const planPrefetch = ({ urlFor, index, centre, budget, skip }: PrefetchPlanInput) => {
  if (!budget.allowed) return []
  const layers = Object.keys(index.layers)
  const present = new Map<string, Set<number>>()
  const has = (layer: string, level: number, id: number) => {
    const key = `${layer}/${level}`
    let set = present.get(key)
    if (!set) present.set(key, (set = new Set(index.layers[layer]?.[String(level)] ?? [])))
    return set.has(id)
  }
  const urls: string[] = []
  const push = (c: Chunk) => {
    const cols = index.levels[String(c.level)].cols
    for (const layer of layers) {
      if (!has(layer, c.level, c.id)) continue
      const url = urlFor(layer, c.level, c.id, cols)
      if (!skip?.has(url)) urls.push(url)
    }
  }
  const levels = Object.keys(index.levels).map(Number).sort((a, b) => b - a)
  for (const level of levels) {
    if (level < COARSE_MIN_LEVEL) continue
    for (const c of chunksAtLevel(index, level, centre)) push(c)
  }
  const fine = chunksAtLevel(index, 0, centre)
  let from = 0
  for (const km of budget.ringsKm) {
    // A chunk belongs to the ring that contains its centre.
    for (const c of fine) if (c.distKm >= from && c.distKm < km) push(c)
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
        // the WebGL grid layer, nothing is read here.
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
