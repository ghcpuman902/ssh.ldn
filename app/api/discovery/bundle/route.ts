import { type NextRequest } from "next/server";

import { buildEvidenceBundle } from "@/lib/server/bundle";

export const GET = async (request: NextRequest) => {
  const testPointId = request.nextUrl.searchParams.get("testPointId");

  if (!testPointId) {
    return Response.json(
      { error: "testPointId is required" },
      { status: 400 }
    );
  }

  try {
    const data = await buildEvidenceBundle(testPointId);

    if (!data) {
      return Response.json(
        { error: `Unknown testPointId: ${testPointId}` },
        { status: 404 }
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Bundle build failed",
      },
      { status: 502 }
    );
  }
};
