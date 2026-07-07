import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  outputFileTracingExcludes: {
    "/api/map/defra/**": ["./data/noise/tiles/**"],
  },
};

export default withBotId(nextConfig);
