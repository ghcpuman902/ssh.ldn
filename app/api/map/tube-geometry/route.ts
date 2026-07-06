import { getTubeGeometryGeoJson } from "@/lib/server/tfl-tube-geometry";

export const GET = async () => {
  try {
    const geometry = await getTubeGeometryGeoJson();
    return Response.json(geometry);
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
