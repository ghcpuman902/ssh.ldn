import { geometryCacheHeaders } from "@/lib/server/http-cache";
import { getOvergroundGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

export const GET = async () => {
  try {
    const geometry = await getOvergroundGeometryGeoJson();

    return Response.json(geometry, {
      headers: geometryCacheHeaders("overground"),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Overground geometry lookup failed",
      },
      { status: 502 },
    );
  }
};
