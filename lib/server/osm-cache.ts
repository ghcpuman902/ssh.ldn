import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_ROOT = path.join(process.cwd(), "data/osm-cache");

/** OSM strategic features change slowly; a fortnight keeps demos fresh enough. */
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const cacheFilePath = (namespace: string, keyParts: Array<string | number>) => {
  const hash = createHash("sha1").update(keyParts.join("|")).digest("hex");
  return path.join(CACHE_ROOT, namespace, `${hash}.json`);
};

/**
 * Cache-first wrapper for expensive Overpass GeoJSON lookups.
 * Repeat map loads read from disk (instant) instead of re-hitting Overpass
 * (7–11s). Falls through to `producer` on miss, stale entry, or read error.
 */
export const withOsmDiskCache = async <T>(
  namespace: string,
  keyParts: Array<string | number>,
  producer: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> => {
  const filePath = cacheFilePath(namespace, keyParts);

  try {
    const meta = await stat(filePath);
    if (Date.now() - meta.mtimeMs < ttlMs) {
      const cached = await readFile(filePath, "utf8");
      return JSON.parse(cached) as T;
    }
  } catch {
    // miss — fall through to producer
  }

  const fresh = await producer();

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(fresh));
  } catch {
    // read-only / ephemeral FS — serving fresh result is still correct
  }

  return fresh;
};
