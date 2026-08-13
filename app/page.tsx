import { preconnect, prefetchDNS, preload } from "react-dom"

import { MapPage } from "@/components/map/map-page"

export default function Page() {
  prefetchDNS("https://tiles.openfreemap.org")
  preconnect("https://tiles.openfreemap.org")
  preload("/api/map/tube-geometry?lod=preview&v=3", {
    as: "fetch",
    crossOrigin: "anonymous",
  })

  return <MapPage />
}
