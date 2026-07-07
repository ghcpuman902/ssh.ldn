import { type NextRequest } from "next/server";

import { enforceBotProtection } from "@/lib/server/bot-protection";
import { geocodeWithGoogle } from "@/lib/server/google-geocoding";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getTestPointById } from "@/lib/test-points";

export const GET = async (request: NextRequest) => {
  const rateLimited = await enforceRateLimit(request, {
    routeName: "discovery-geocode-google",
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

  let address = addressParam ?? "";
  let resolvedTestPointId: string | undefined;

  if (testPointId) {
    const testPoint = getTestPointById(testPointId);

    if (!testPoint) {
      return Response.json(
        { error: `Unknown testPointId: ${testPointId}` },
        { status: 404 }
      );
    }

    address = testPoint.address;
    resolvedTestPointId = testPoint.id;
  }

  if (!address.trim()) {
    return Response.json(
      { error: "Provide testPointId or address query parameter" },
      { status: 400 }
    );
  }

  try {
    const result = await geocodeWithGoogle({
      address,
      testPointId: resolvedTestPointId,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google geocoding failed";

    return Response.json({ error: message }, { status: 502 });
  }
};
