import { type NextRequest } from "next/server";

import { decodeNoiseTimeSlot } from "@/lib/map/noise-time";
import { scoreFromBundle } from "@/lib/server/score";

export const GET = async (request: NextRequest) => {
  const testPointId = request.nextUrl.searchParams.get("testPointId") ?? undefined;
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");
  const lat = latParam !== null ? Number(latParam) : undefined;
  const lng = lngParam !== null ? Number(lngParam) : undefined;
  const floor = Number(request.nextUrl.searchParams.get("floor") ?? 0);
  const facing = request.nextUrl.searchParams.get("facing") ?? "unknown";
  const timeSlotParam =
    request.nextUrl.searchParams.get("timeSlot") ??
    (request.nextUrl.searchParams.get("week") &&
    request.nextUrl.searchParams.get("part")
      ? `${request.nextUrl.searchParams.get("week")}-${request.nextUrl.searchParams.get("part")}`
      : null);
  const timeSlot = timeSlotParam ? decodeNoiseTimeSlot(timeSlotParam) : null;

  if (timeSlotParam && !timeSlot) {
    return Response.json(
      { error: "timeSlot must be weekday-day, weekday-night, weekend-day, or weekend-night" },
      { status: 400 }
    );
  }

  if (!testPointId && (lat === undefined || lng === undefined)) {
    return Response.json(
      { error: "testPointId or lat/lng are required" },
      { status: 400 }
    );
  }

  try {
    const data = await scoreFromBundle({
      testPointId,
      lat,
      lng,
      floor: Number.isFinite(floor) ? floor : 0,
      facing,
      timeSlot: timeSlot ?? undefined,
    });

    if (!data) {
      return Response.json(
        { error: testPointId ? `Unknown testPointId: ${testPointId}` : "Score failed" },
        { status: 404 }
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Score computation failed",
      },
      { status: 502 }
    );
  }
};
