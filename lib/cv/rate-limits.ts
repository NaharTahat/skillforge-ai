import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

/**
 * Per-user limits for expensive CV work. In-memory (per server instance, reset
 * on restart) like the auth limiters — replace with a shared store (e.g. Redis)
 * before running more than one instance.
 */
const HOUR = 60 * 60 * 1000;

export const cvUploadLimiter = createRateLimiter({ name: "cv-upload", limit: 10, windowMs: HOUR });
export const cvAnalysisLimiter = createRateLimiter({
  name: "cv-analysis",
  limit: 20,
  windowMs: HOUR,
});
