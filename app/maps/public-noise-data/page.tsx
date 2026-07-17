import type { Metadata } from "next"
import { Suspense } from "react"

import { PublicNoiseMapPage } from "@/components/public-noise-map/public-noise-map-page"

export const metadata: Metadata = {
  title: "Public Tube interior noise — ssh-ldn",
  description:
    "Internal reference prototype: geographic Tube section noise map from published FOI and academic measurements. Not an open dataset.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function PublicNoiseDataRoutePage() {
  return (
    <Suspense
      fallback={
        <div
          aria-busy="true"
          aria-label="Loading public noise map"
          className="h-svh w-full animate-pulse bg-muted"
        />
      }
    >
      <PublicNoiseMapPage />
    </Suspense>
  )
}
