/** Bump when committed transit preview/full JSON changes so browsers and CDNs drop the previous geometry. */
export const TRANSIT_GEOMETRY_CACHE_VERSION = 4

export const withTransitGeometryCache = (url: string) =>
  `${url}${url.includes("?") ? "&" : "?"}v=${TRANSIT_GEOMETRY_CACHE_VERSION}`
