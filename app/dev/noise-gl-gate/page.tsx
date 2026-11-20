import { notFound } from "next/navigation"

import { NoiseGlGateClient } from "./noise-gl-gate-client"

/**
 * Dev-only GPU gate for the WebGL noise layer. Renders one grid layer alone
 * on an opaque black background at ?z=&lat=&lng=&layer= (optional ?base= for
 * a local grid, ?opacity=, default 1) and exposes window.__noiseGate for
 * scripts/noise-gl-gate.mjs.
 */
export default function NoiseGlGatePage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return <NoiseGlGateClient />
}
