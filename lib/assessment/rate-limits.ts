import "server-only";
import { createRateLimiter } from "@/lib/security/rate-limit";

/**
 * Assessment limits, per user. In-memory like the other limiters: correct for a
 * single server instance only — not distributed. Move to a shared store (e.g.
 * Redis) before running more than one instance.
 */
export const ASSESSMENT_GENERATIONS_PER_HOUR = 10;
export const ANSWER_SAVES_PER_HOUR = 400;
/** Submissions trigger AI evaluation of open answers and the result analysis. */
export const SUBMISSIONS_PER_HOUR = 30;

const HOUR = 60 * 60 * 1000;

/** New assessments and "Practice again". */
export const assessmentGenerationLimiter = createRateLimiter({
  name: "assessment-generation",
  limit: ASSESSMENT_GENERATIONS_PER_HOUR,
  windowMs: HOUR,
});
export const answerSaveLimiter = createRateLimiter({
  name: "assessment-answer-save",
  limit: ANSWER_SAVES_PER_HOUR,
  windowMs: HOUR,
});
/** Submission/result generation, including AI short-answer evaluation. */
export const submissionLimiter = createRateLimiter({
  name: "assessment-submission",
  limit: SUBMISSIONS_PER_HOUR,
  windowMs: HOUR,
});
