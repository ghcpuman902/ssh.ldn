import {
  streamTransitGeometryFile,
  type TransitGeometryLod,
  type TransitMode,
} from "@/lib/server/static-transit-geometry";

const MODE_ERROR: Record<TransitMode, string> = {
  tube: "Tube geometry lookup failed",
  overground: "Overground geometry lookup failed",
  elizabeth: "Elizabeth line geometry lookup failed",
  dlr: "DLR geometry lookup failed",
  tram: "Tram geometry lookup failed",
};

export type { TransitGeometryLod };

export const parseTransitGeometryLod = (
  request: Request
): TransitGeometryLod => {
  const lod = new URL(request.url).searchParams.get("lod");
  return lod === "preview" ? "preview" : "full";
};

export const transitGeometryGet = async (
  mode: TransitMode,
  request: Request
) => {
  const lod = parseTransitGeometryLod(request);

  try {
    return await streamTransitGeometryFile(mode, lod);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : MODE_ERROR[mode],
      },
      { status: 502 }
    );
  }
};
