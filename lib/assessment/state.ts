import { EXPIRY_GRACE_SECONDS, type AssessmentStatus } from "./constants";
import type { AssessmentErrorCode } from "./errors";

/**
 * Explicit state machines (no AI involved).
 *
 * Assessment: DRAFT → GENERATING → IN_PROGRESS → COMPLETED | EXPIRED
 *             DRAFT/GENERATING → FAILED (replaced via "Practice again")
 * Question:   PENDING → ANSWERED | SKIPPED (never back; answers are locked once saved)
 */
const TRANSITIONS: Record<AssessmentStatus, readonly AssessmentStatus[]> = {
  DRAFT: ["GENERATING", "FAILED"],
  GENERATING: ["IN_PROGRESS", "FAILED"],
  IN_PROGRESS: ["COMPLETED", "EXPIRED"],
  COMPLETED: [],
  EXPIRED: [],
  FAILED: [],
};

export function canTransition(from: AssessmentStatus, to: AssessmentStatus) {
  return TRANSITIONS[from].includes(to);
}

export const isGenerating = (s: AssessmentStatus) => s === "DRAFT" || s === "GENERATING";
export const isFinished = (s: AssessmentStatus) => s === "COMPLETED" || s === "EXPIRED";

/** True once the time limit (plus a short grace period for network latency) has passed. */
export function isPastDeadline(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt !== null && now.getTime() > expiresAt.getTime() + EXPIRY_GRACE_SECONDS * 1000;
}

export function deadlineFrom(startedAt: Date, timeLimitMinutes: number | null): Date | null {
  return timeLimitMinutes === null
    ? null
    : new Date(startedAt.getTime() + timeLimitMinutes * 60_000);
}

/** Why an answer can't be saved right now, or null when it can. */
export function answerBlocker(
  a: { status: AssessmentStatus; startedAt: Date | null; expiresAt: Date | null },
  questionStatus: "PENDING" | "ANSWERED" | "SKIPPED",
  now: Date = new Date(),
): AssessmentErrorCode | null {
  if (isFinished(a.status)) return "ALREADY_FINISHED";
  if (a.status !== "IN_PROGRESS") return "NOT_ACTIVE";
  if (!a.startedAt) return "NOT_STARTED";
  if (isPastDeadline(a.expiresAt, now)) return "EXPIRED";
  if (questionStatus !== "PENDING") return "ALREADY_ANSWERED";
  return null;
}

export type AssessmentProgress = { answered: number; total: number; percent: number };

/** Answered ÷ questions, computed from question states only. */
export function assessmentProgress(
  questions: { status: "PENDING" | "ANSWERED" | "SKIPPED" }[],
): AssessmentProgress {
  const answered = questions.filter((q) => q.status === "ANSWERED").length;
  const total = questions.length;
  return { answered, total, percent: total === 0 ? 0 : Math.round((answered / total) * 100) };
}
