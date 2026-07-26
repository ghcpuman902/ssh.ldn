import { geometryCacheHeaders } from "@/lib/server/http-cache";
import { getDlrGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

/** Cold Overpass + TfL build can be slow; cache hits return immediately. */
export const maxDuration = 120;

export const GET = async () => {
  try {
    const geometry = await getDlrGeometryGeoJson();

    return Response.json(geometry, {
      headers: geometryCacheHeaders("dlr"),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "DLR geometry lookup failed",
      },
      { status: 502 },
    );
  }
};
