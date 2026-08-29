import { kv } from "@vercel/kv";

const memory = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(key: string, limit = 30, windowSeconds = 60) {
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const redisKey = `rate:${key}`;
    const count = await kv.incr(redisKey);
    if (count === 1) {
      await kv.expire(redisKey, windowSeconds);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }

  const current = memory.get(key);
  if (!current || current.resetAt < now) {
    memory.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function clientKey(request: Request, suffix: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${suffix}:${forwarded || "local"}`;
}
