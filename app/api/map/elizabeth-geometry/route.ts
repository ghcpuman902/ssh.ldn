import { getElizabethGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

export const GET = async () => {
  try {
    const geometry = await getElizabethGeometryGeoJson();

    return Response.json(geometry, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
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
