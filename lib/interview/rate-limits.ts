import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

/**
 * Interview limits, per user. In-memory like the other limiters: correct for a
 * single server instance only — not distributed. Move to a shared store (e.g.
 * Redis) before running more than one instance.
 */
export const INTERVIEW_GENERATIONS_PER_HOUR = 10;
export const ANSWER_SUBMISSIONS_PER_HOUR = 120;

/** New interviews and "Practice again". */
export const interviewGenerationLimiter = createRateLimiter({
  name: "interview-generation",
  limit: INTERVIEW_GENERATIONS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});

/** Answer submissions and evaluation retries (each one is an AI call). */
export const answerSubmissionLimiter = createRateLimiter({
  name: "interview-answer",
  limit: ANSWER_SUBMISSIONS_PER_HOUR,
  windowMs: 60 * 60 * 1000,
});
