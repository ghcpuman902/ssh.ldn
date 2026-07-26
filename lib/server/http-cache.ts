/**
 * CDN / browser cache header profiles for map & discovery routes.
 * Apply only to successful (2xx) responses — errors must stay uncached.
 */

const tagHeader = (...tags: string[]) => tags.join(",");

/** OSM cell / radius GeoJSON — aligned with 14-day osm-cache TTL. */
export const osmCellCacheHeaders = (namespace: string): HeadersInit => ({
  "Cache-Control":
    "public, max-age=86400, s-maxage=1209600, stale-while-revalidate=604800",
  "Vercel-CDN-Cache-Control":
    "public, max-age=1209600, stale-while-revalidate=604800",
  "Vercel-Cache-Tag": tagHeader("osm", namespace),
});

/** Transit geometry GeoJSON — 7d browser / CDN, 30d SWR. */
export const geometryCacheHeaders = (mode: string): HeadersInit => ({
  "Cache-Control":
    "public, max-age=604800, stale-while-revalidate=2592000",
  "Vercel-CDN-Cache-Control":
    "public, max-age=604800, stale-while-revalidate=2592000",
  "Vercel-Cache-Tag": tagHeader("geometry", mode),
});

/** Raster map tiles (DEFRA / POI density). */
export const tileCacheHeaders = (tag: string): HeadersInit => ({
  "Content-Type": "image/png",
  "Cache-Control":
    "public, max-age=86400, stale-while-revalidate=604800",
  "Vercel-CDN-Cache-Control":
    "public, max-age=86400, stale-while-revalidate=604800",
  "Vercel-Cache-Tag": tag,
});

/** DEFRA point samples — short browser, 1d CDN. */
export const defraSampleCacheHeaders = (): HeadersInit => ({
  "Cache-Control":
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  "Vercel-CDN-Cache-Control":
    "public, max-age=86400, stale-while-revalidate=604800",
  "Vercel-Cache-Tag": "defra-sample",
});
