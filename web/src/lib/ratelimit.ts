import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Shared rate limiter (Upstash Redis) so limits hold ACROSS edge/serverless
// instances — unlike the per-instance in-memory limiter in middleware.ts. Used
// to guard guest-writable POSTs (/inquiry, /reviews), which are spam and
// email-bomb vectors.
//
// When the Upstash env is absent (local dev / CI), this degrades to a graceful
// no-op that always allows — so nothing breaks without Redis configured.
//
// Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.

export interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        // 30 writes / minute / identifier, sliding window.
        limiter: Ratelimit.slidingWindow(30, "60 s"),
        analytics: false,
        prefix: "rl",
      })
    : null;

/** Returns whether the limiter is backed by real Redis (vs. the no-op fallback). */
export function rateLimitEnabled(): boolean {
  return limiter !== null;
}

/**
 * Check the shared rate limit for `identifier` (e.g. an IP or `ip:route`).
 * No-ops to `success: true` when Upstash is not configured.
 */
export async function checkRateLimit(identifier: string): Promise<LimitResult> {
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return { success, limit, remaining, reset };
}
