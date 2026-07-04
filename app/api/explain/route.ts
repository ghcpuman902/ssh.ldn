import { type NextRequest } from "next/server";

import { explainFromScore } from "@/lib/server/score";

export const GET = async (request: NextRequest) => {
  const testPointId = request.nextUrl.searchParams.get("testPointId") ?? undefined;
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");
  const lat = latParam !== null ? Number(latParam) : undefined;
  const lng = lngParam !== null ? Number(lngParam) : undefined;
  const floor = Number(request.nextUrl.searchParams.get("floor") ?? 0);
  const facing = request.nextUrl.searchParams.get("facing") ?? "unknown";

  if (!testPointId && (lat === undefined || lng === undefined)) {
    return Response.json(
      { error: "testPointId or lat/lng are required" },
      { status: 400 }
    );
  }

  try {
    const data = await explainFromScore({
      testPointId,
      lat,
      lng,
      floor: Number.isFinite(floor) ? floor : 0,
      facing,
    });

    if (!data) {
      return Response.json(
        { error: testPointId ? `Unknown testPointId: ${testPointId}` : "Explain failed" },
        { status: 404 }
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Explanation failed",
      },
      { status: 502 }
    );
  }
};
