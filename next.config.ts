import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingExcludes: {
    "/api/map/defra/**": ["./data/noise/tiles/**"],
  },
  turbopack: {
    ignoreIssue: [
      {
        path: "**/lib/server/local-noise-tile.ts",
        description: /Overly broad patterns/,
      },
    ],
  },
};

export default withBotId(nextConfig);
