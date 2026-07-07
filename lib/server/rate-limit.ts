import { getClientIp } from "@/lib/server/client-ip";
import { getRedisClient } from "@/lib/server/redis";

export type RateLimitConfig = {
  routeName: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

export const checkRateLimit = async ({
  key,
  limit,
  windowSeconds,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> => {
  const now = Date.now();
  const failOpen: RateLimitResult = {
    allowed: true,
    remaining: limit,
    resetAt: now + windowSeconds * 1_000,
    retryAfterSeconds: 0,
  };

  try {
    const redis = await getRedisClient();

    if (!redis) {
      console.warn("[rate-limit] REDIS_URL not configured; allowing request");
      return failOpen;
    }

    const result = (await redis.eval(RATE_LIMIT_LUA, {
      keys: [key],
      arguments: [String(windowSeconds)],
    })) as [number, number];

    const [count, ttl] = result;
    const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
    const resetAt = now + retryAfterSeconds * 1_000;
    const remaining = Math.max(0, limit - count);

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
      retryAfterSeconds,
    };
  } catch (error) {
    console.warn("[rate-limit] Redis check failed; allowing request", error);
    return failOpen;
  }
};

export const buildRateLimitKey = (routeName: string, identifier: string) =>
  `rate-limit:${routeName}:${identifier}`;

export const enforceRateLimit = async (
  request: Request,
  config: RateLimitConfig
): Promise<Response | null> => {
  const ip = getClientIp(request);
  const key = buildRateLimitKey(config.routeName, ip);
  const result = await checkRateLimit({
    key,
    limit: config.limit,
    windowSeconds: config.windowSeconds,
  });

  if (result.allowed) {
    return null;
  }

  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(config.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
      },
    }
  );
};
