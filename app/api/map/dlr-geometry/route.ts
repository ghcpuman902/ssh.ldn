import { transitGeometryGet } from "@/lib/server/transit-geometry-response";

export const GET = async (request: Request) =>
  transitGeometryGet("dlr", request);
