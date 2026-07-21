import { getTramGeometryGeoJson } from "@/lib/server/tfl-transit-geometry";

/** Cold Overpass + TfL build can be slow; cache hits return immediately. */
export const maxDuration = 120;

export const GET = async () => {
  try {
    const geometry = await getTramGeometryGeoJson();

    return Response.json(geometry, {
      headers: {
        "Cache-Control":
          "public, max-age=604800, stale-while-revalidate=2592000",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Tram geometry lookup failed",
      },
      { status: 502 },
    );
  }
};
