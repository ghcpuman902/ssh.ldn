import { type NextRequest } from "next/server";

import { enforceBotProtection } from "@/lib/server/bot-protection";
import { geocodeAddress, geocodeFromTestPoint } from "@/lib/server/geocode";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getTestPoint } from "@/lib/server/test-points";

export const GET = async (request: NextRequest) => {
  const rateLimited = await enforceRateLimit(request, {
    routeName: "discovery-geocode",
    limit: 20,
    windowSeconds: 60,
  });

  if (rateLimited) {
    return rateLimited;
  }

  const botBlocked = await enforceBotProtection();

  if (botBlocked) {
    return botBlocked;
  }

  const testPointId = request.nextUrl.searchParams.get("testPointId");
  const addressParam = request.nextUrl.searchParams.get("address");

  if (testPointId) {
    const testPoint = getTestPoint(testPointId);

    if (!testPoint) {
      return Response.json(
        { error: `Unknown testPointId: ${testPointId}` },
        { status: 404 }
      );
    }

    return Response.json(geocodeFromTestPoint(testPointId));
  }

  const address = addressParam ?? "";

  if (!address.trim()) {
    return Response.json(
      { error: "Provide testPointId or address query parameter" },
      { status: 400 }
    );
  }

  try {
    const result = await geocodeAddress({ address });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Geocoding failed unexpectedly";

    return Response.json({ error: message }, { status: 502 });
  }
};
