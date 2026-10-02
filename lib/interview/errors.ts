import { CV_ERROR_MESSAGES } from "@/lib/cv/errors";

/** User-facing interview messages. Nothing internal (stack traces, AI output) reaches the client. */
export const INTERVIEW_ERROR_MESSAGES = {
  NO_CV: "Analyze your CV first to start an AI interview.",
  CV_NOT_ANALYZED: "Complete your CV analysis before starting an interview.",
  CV_NOT_FOUND: "That CV isn't available. Choose one of your analyzed CVs.",
  NO_JOB_MATCH: "Create a Job Match first to generate a job-specific interview.",
  JOB_MATCH_NOT_FOUND: "That job match isn't available. Choose one of your completed job matches.",
  JOB_MATCH_NOT_READY:
    "This job match hasn't finished yet. Start an interview once its report is ready.",
  NO_CAREER_GOAL: "Set your career goal in Profile first.",
  SOURCE_DELETED:
    "A source used for this interview (CV or job match) has been deleted. Start a new interview instead.",
  INVALID_CONFIG: "Check the interview settings and try again.",
  INTERVIEW_NOT_FOUND: "This interview doesn't exist or you don't have access to it.",
  QUESTION_NOT_FOUND: "This question doesn't exist or you don't have access to it.",
  INTERVIEW_NOT_ACTIVE: "This interview isn't ready for answers yet.",
  INTERVIEW_COMPLETED:
    "This interview is already completed. Start a new practice interview to answer again.",
  ALREADY_ANSWERED: "This question has already been answered.",
  QUESTION_NOT_ANSWERED: "Answer this question before requesting feedback.",
  EVALUATION_NOT_FAILED: "This answer already has feedback.",
  NOT_FINISHED: "Answer or skip every question before finishing the interview.",
  EVALUATIONS_PENDING: "Some answers still need feedback. Retry them before finishing.",
  AI_UNAVAILABLE: CV_ERROR_MESSAGES.AI_UNAVAILABLE,
  AI_TIMEOUT: CV_ERROR_MESSAGES.AI_TIMEOUT,
  AI_INVALID_OUTPUT: "The AI returned an unexpected result. Please try again.",
  AI_RATE_LIMITED: CV_ERROR_MESSAGES.AI_RATE_LIMITED,
  AI_REFUSED: "The AI service declined this request. Please try again with different settings.",
  GENERATION_INTERRUPTED: "Generating this interview was interrupted. Please practice again.",
  DATABASE_ERROR: "Something went wrong saving your interview. Please try again.",
  RATE_LIMITED: CV_ERROR_MESSAGES.RATE_LIMITED,
  ANSWER_RATE_LIMITED:
    "You're submitting answers very quickly. Please wait {minutes} minute(s) and try again.",
  UNKNOWN: CV_ERROR_MESSAGES.UNKNOWN,
} as const;

export type InterviewErrorCode = keyof typeof INTERVIEW_ERROR_MESSAGES;

export function interviewErrorMessage(
  code: string | null | undefined,
  vars: Record<string, string> = {},
) {
  const template =
    code && code in INTERVIEW_ERROR_MESSAGES
      ? INTERVIEW_ERROR_MESSAGES[code as InterviewErrorCode]
      : INTERVIEW_ERROR_MESSAGES.UNKNOWN;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export class InterviewError extends Error {
  constructor(
    readonly code: InterviewErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "InterviewError";
  }
}
