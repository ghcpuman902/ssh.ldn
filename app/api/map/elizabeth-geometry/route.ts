import { geometryCacheHeaders } from "@/lib/server/http-cache";
import { getElizabethGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

export const GET = async () => {
  try {
    const geometry = await getElizabethGeometryGeoJson();

    return Response.json(geometry, {
      headers: geometryCacheHeaders("elizabeth"),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Elizabeth line geometry lookup failed",
      },
      { status: 502 },
    );
  }
};
