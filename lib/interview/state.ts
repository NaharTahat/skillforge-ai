import { MAX_FOLLOW_UPS, type InterviewStatus, type QuestionStatus } from "./constants";
import type { InterviewErrorCode } from "./errors";

/**
 * Explicit state machines (no AI involved).
 *
 * Interview: DRAFT → GENERATING → IN_PROGRESS → COMPLETED
 *            DRAFT/GENERATING → FAILED (a failed interview is replaced via "Practice again")
 * Question:  PENDING → ANSWERED | SKIPPED (never back)
 */
const INTERVIEW_TRANSITIONS: Record<InterviewStatus, readonly InterviewStatus[]> = {
  DRAFT: ["GENERATING", "FAILED"],
  GENERATING: ["IN_PROGRESS", "FAILED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  FAILED: [],
};

export function canTransitionInterview(from: InterviewStatus, to: InterviewStatus): boolean {
  return INTERVIEW_TRANSITIONS[from].includes(to);
}

export function canTransitionQuestion(from: QuestionStatus, to: QuestionStatus): boolean {
  return from === "PENDING" && (to === "ANSWERED" || to === "SKIPPED");
}

export function isGenerating(status: InterviewStatus) {
  return status === "DRAFT" || status === "GENERATING";
}

/** Why an answer can't be accepted for this question right now, or null when it can. */
export function answerBlocker(
  interviewStatus: InterviewStatus,
  questionStatus: QuestionStatus,
): InterviewErrorCode | null {
  if (interviewStatus === "COMPLETED") return "INTERVIEW_COMPLETED";
  if (interviewStatus !== "IN_PROGRESS") return "INTERVIEW_NOT_ACTIVE";
  if (questionStatus !== "PENDING") return "ALREADY_ANSWERED";
  return null;
}

/** A follow-up may be added after answering question `followUpIndex` (0 = primary). */
export function canAddFollowUp(followUpIndex: number): boolean {
  return followUpIndex + 1 <= MAX_FOLLOW_UPS;
}
