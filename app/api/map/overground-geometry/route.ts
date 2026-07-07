import { getOvergroundGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

export const GET = async () => {
  try {
    const geometry = await getOvergroundGeometryGeoJson();

    return Response.json(geometry, {
      headers: {
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
      },
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
