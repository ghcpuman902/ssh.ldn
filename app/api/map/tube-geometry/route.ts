import { geometryCacheHeaders } from "@/lib/server/http-cache";
import { getTubeGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

export const GET = async () => {
  try {
    const geometry = await getTubeGeometryGeoJson();

    return Response.json(geometry, {
      headers: geometryCacheHeaders("tube"),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Tube geometry lookup failed",
      },
      { status: 502 },
    );
  }
};
