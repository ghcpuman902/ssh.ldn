import { NIGHTLIFE_CACHE_VERSION } from "@/lib/map/nightlife-venue-tags"
import type { NightlifeFeatureCollection } from "@/lib/map/geojson-types"

const DB_NAME = "ssh-ldn-nightlife"
const STORE_NAME = "cells"
const DB_VERSION = 1
/** Match server OSM disk cache TTL. */
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000

type CachedNightlifeCell = {
  version: string
  cachedAt: number
  data: NightlifeFeatureCollection
}

let dbPromise: Promise<IDBDatabase> | null = null

const openDb = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"))
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"))
    })
  }

  return dbPromise
}

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) => {
  const db = await openDb()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = run(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"))
  })
}

export const nightlifeCellApiKey = (row: number, col: number) =>
  `/api/discovery/osm/nightlife?row=${row}&col=${col}`

const isFresh = (entry: CachedNightlifeCell | undefined) => {
  if (!entry) return false
  if (entry.version !== NIGHTLIFE_CACHE_VERSION) return false
  return Date.now() - entry.cachedAt < CACHE_TTL_MS
}

export const readNightlifeCellCache = async (key: string) => {
  try {
    const entry = await withStore("readonly", (store) => store.get(key))
    if (!isFresh(entry as CachedNightlifeCell | undefined)) {
      return null
    }

    return (entry as CachedNightlifeCell).data
  } catch {
    return null
  }
}

export const writeNightlifeCellCache = async (
  key: string,
  data: NightlifeFeatureCollection
) => {
  try {
    const entry: CachedNightlifeCell = {
      version: NIGHTLIFE_CACHE_VERSION,
      cachedAt: Date.now(),
      data,
    }

    await withStore("readwrite", (store) => store.put(entry, key))
  } catch {
    // Ignore quota / private mode failures — network fetch still works.
  }
}

export const fetchNightlifeCell = async (
  row: number,
  col: number,
  signal?: AbortSignal
): Promise<NightlifeFeatureCollection | null> => {
  const key = nightlifeCellApiKey(row, col)
  const cached = await readNightlifeCellCache(key)
  if (cached) return cached

  const response = await fetch(key, { signal })
  if (!response.ok) return null

  const data = (await response.json()) as NightlifeFeatureCollection
  await writeNightlifeCellCache(key, data)
  return data
}
