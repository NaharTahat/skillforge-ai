import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

/**
 * AI Job Match runs (new matches and re-runs) per user. In-memory like the
 * other limiters: correct for a single server instance only; move to a shared
 * store (e.g. Redis) before scaling horizontally.
 */
export const JOB_MATCH_LIMIT_PER_HOUR = 20;

export const jobMatchLimiter = createRateLimiter({
  name: "job-match",
  limit: JOB_MATCH_LIMIT_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
