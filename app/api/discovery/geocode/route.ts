import { type NextRequest } from "next/server";

import { geocodeAddress } from "@/lib/server/geocode";
import { getTestPointById } from "@/lib/test-points";

export const GET = async (request: NextRequest) => {
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
    const result = await geocodeAddress({
      address,
      testPointId: resolvedTestPointId,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Geocoding failed unexpectedly";

    return Response.json({ error: message }, { status: 502 });
  }
};
