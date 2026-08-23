"use client"

import dynamic from "next/dynamic"

const MapShell = dynamic(
  () => import("@/components/map/map-shell").then((mod) => mod.MapShell),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        aria-label="Loading map"
        className="h-svh w-full animate-pulse bg-muted"
      />
    ),
  }
)

export const MapPage = () => (
  <main className="h-svh w-full overscroll-none">
    <MapShell />
  </main>
)
