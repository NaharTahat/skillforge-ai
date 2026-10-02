import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

/**
 * AI portfolio assistance (headline, bio, project description, skill summary),
 * per user. Every request counts, including a duplicate that is answered from
 * the in-flight request. In-memory like the other limiters: per server
 * instance only, not distributed.
 */
export const PORTFOLIO_AI_PER_HOUR = 10;

export const portfolioAiLimiter = createRateLimiter({
  name: "portfolio-ai",
  limit: PORTFOLIO_AI_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
