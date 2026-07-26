import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCache } from "@vercel/functions";

const CACHE_ROOT = path.join(process.cwd(), "data/osm-cache");

/** OSM strategic features change slowly; a fortnight keeps demos fresh enough. */
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Runtime Cache hard limit is 2 MB — stay under to avoid set failures. */
const RUNTIME_CACHE_MAX_BYTES = Math.floor(1.8 * 1024 * 1024);

/** Hash matches legacy disk filenames (keyParts only; namespace is the directory). */
const cacheKeyHash = (keyParts: Array<string | number>) =>
  createHash("sha1").update(keyParts.join("|")).digest("hex");

const cacheFilePath = (namespace: string, hash: string) =>
  path.join(CACHE_ROOT, namespace, `${hash}.json`);

const getRuntimeCache = () => getCache({ namespace: "osm" });

const readRuntimeCache = async <T>(key: string): Promise<T | undefined> => {
  try {
    const cached = await getRuntimeCache().get(key);
    if (cached == null) return undefined;
    return cached as T;
  } catch {
    return undefined;
  }
};

const writeRuntimeCache = async (
  key: string,
  value: unknown,
  namespace: string,
  ttlMs: number,
  serialized: string
) => {
  if (Buffer.byteLength(serialized, "utf8") > RUNTIME_CACHE_MAX_BYTES) {
    return;
  }

  try {
    await getRuntimeCache().set(key, value, {
      ttl: Math.floor(ttlMs / 1000),
      tags: [namespace],
      name: `${namespace}:${key.slice(0, 8)}`,
    });
  } catch {
    // Runtime Cache unavailable (local) or set failed — ignore
  }
};

const readDiskCache = async <T>(
  filePath: string,
  ttlMs: number
): Promise<T | undefined> => {
  try {
    const meta = await stat(filePath);
    if (Date.now() - meta.mtimeMs >= ttlMs) return undefined;
    const cached = await readFile(filePath, "utf8");
    return JSON.parse(cached) as T;
  } catch {
    return undefined;
  }
};

const writeDiskCache = async (filePath: string, serialized: string) => {
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, serialized);
  } catch {
    // read-only / ephemeral FS — serving fresh result is still correct
  }
};

/**
 * Cache-first wrapper for expensive Overpass GeoJSON lookups.
 * Order: Vercel Runtime Cache → local disk → producer, then write-through.
 */
export const withOsmCache = async <T>(
  namespace: string,
  keyParts: Array<string | number>,
  producer: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> => {
  const hash = cacheKeyHash(keyParts);
  const runtimeKey = `${namespace}:${hash}`;
  const filePath = cacheFilePath(namespace, hash);

  const fromRuntime = await readRuntimeCache<T>(runtimeKey);
  if (fromRuntime !== undefined) return fromRuntime;

  const fromDisk = await readDiskCache<T>(filePath, ttlMs);
  if (fromDisk !== undefined) {
    const serialized = JSON.stringify(fromDisk);
    await writeRuntimeCache(runtimeKey, fromDisk, namespace, ttlMs, serialized);
    return fromDisk;
  }

  const fresh = await producer();
  const serialized = JSON.stringify(fresh);

  await writeRuntimeCache(runtimeKey, fresh, namespace, ttlMs, serialized);
  await writeDiskCache(filePath, serialized);

  return fresh;
};
