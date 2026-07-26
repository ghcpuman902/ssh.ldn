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
    ],
  },
};

export default withBotId(nextConfig);
