import { getTestPoints } from "@/lib/server/test-points";

export const GET = async () => {
  return Response.json({
    source: "internal",
    sourceEndpoint: "test-points",
    retrievedAt: new Date().toISOString(),
    testPoints: getTestPoints(),
  });
};
