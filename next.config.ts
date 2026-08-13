import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingExcludes: {
    "/api/map/defra/**": ["./data/noise/tiles/**"],
  },
  outputFileTracingIncludes: {
    "/api/map/poi-density/**": [
      "./public/poi-density/tiles/**",
      "./public/poi-density/empty.png",
    ],
    "/api/map/tube-geometry/**": ["./data/transit/**"],
    "/api/map/overground-geometry/**": ["./data/transit/**"],
    "/api/map/elizabeth-geometry/**": ["./data/transit/**"],
    "/api/map/dlr-geometry/**": ["./data/transit/**"],
    "/api/map/tram-geometry/**": ["./data/transit/**"],
    "/api/discovery/osm/nightlife/**": ["./data/osm-static/nightlife/**"],
    "/api/discovery/osm/rail-visual/**": [
      "./data/osm-static/rail-lines/**",
      "./data/osm-static/rail-stations/**",
    ],
    "/api/discovery/osm/green-spaces/**": ["./data/osm-static/green-spaces/**"],
  },
  turbopack: {
    ignoreIssue: [
      {
        path: "**/lib/server/local-noise-tile.ts",
        description: /Overly broad patterns/,
      },
      {
        path: "**/app/api/map/poi-density/**/route.ts",
        description: /Overly broad patterns/,
      },
      {
        path: "**/lib/server/static-transit-geometry.ts",
        description: /Overly broad patterns/,
      },
      {
        path: "**/lib/server/static-osm-cells.ts",
        description: /Overly broad patterns/,
      },
    ],
  },
};

export default withBotId(nextConfig);
