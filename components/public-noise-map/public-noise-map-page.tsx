"use client"

import dynamic from "next/dynamic"

const PublicNoiseMapShell = dynamic(
  () =>
    import("@/components/public-noise-map/public-noise-map-shell").then(
      (mod) => mod.PublicNoiseMapShell,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-busy="true"
        aria-label="Loading public noise map"
        className="h-svh w-full animate-pulse bg-muted"
      />
    ),
  },
)

export const PublicNoiseMapPage = () => (
  <main className="h-svh w-full overflow-hidden">
    <PublicNoiseMapShell />
  </main>
)
