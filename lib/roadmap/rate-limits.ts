import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

/**
 * Roadmap generations (new + re-generate) per user. Task status updates are
 * not counted. In-memory like the other limiters: correct for one server
 * instance only; move to a shared store (e.g. Redis) before scaling out.
 */
export const ROADMAP_LIMIT_PER_HOUR = 10;

export const roadmapLimiter = createRateLimiter({
  name: "roadmap-generation",
  limit: ROADMAP_LIMIT_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
