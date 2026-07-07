import { ipAddress } from "@vercel/functions";

export const getClientIp = (request: Request): string => {
  const ip = ipAddress(request);

  if (ip) {
    return ip;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  return "unknown";
};
