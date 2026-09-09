import { preconnect, prefetchDNS, preload } from "react-dom"

import { MapPage } from "@/components/map/map-page"
import { TRANSIT_GEOMETRY_CACHE_VERSION } from "@/lib/map/transit-geometry-cache"

export default function Page() {
  prefetchDNS("https://tiles.openfreemap.org")
  preconnect("https://tiles.openfreemap.org")
  preload(
    `/api/map/tube-geometry?lod=preview&v=${TRANSIT_GEOMETRY_CACHE_VERSION}`,
    {
      as: "fetch",
      crossOrigin: "anonymous",
    }
  )

  return <MapPage />
}
