import { CV_ERROR_MESSAGES } from "@/lib/cv/errors";

/** User-facing assessment messages. Nothing internal (stack traces, AI output) reaches the client. */
export const ASSESSMENT_ERROR_MESSAGES = {
  NO_CV: "Upload your CV first.",
  CV_NOT_ANALYZED: "Analyze your CV first.",
  CV_NOT_FOUND: "That CV isn't available. Choose one of your analyzed CVs.",
  NO_JOB_MATCH: "Create a Job Match first.",
  JOB_MATCH_NOT_FOUND: "That job match isn't available. Choose one of your completed job matches.",
  JOB_MATCH_NOT_READY:
    "This job match hasn't finished yet. Start an assessment once its report is ready.",
  NO_CAREER_GOAL: "Create a Career Goal first.",
  NO_SUPPORTED_SKILLS:
    "None of the skills in this source can be assessed yet. Choose skills directly with a Skill assessment.",
  SOURCE_DELETED:
    "A source used for this assessment (CV or job match) has been deleted. Start a new assessment instead.",
  INVALID_CONFIG: "Check the assessment settings and try again.",
  ASSESSMENT_NOT_FOUND: "This assessment doesn't exist or you don't have access to it.",
  QUESTION_NOT_FOUND: "This question doesn't exist or you don't have access to it.",
  NOT_STARTED: "Start the assessment before answering.",
  NOT_ACTIVE: "This assessment isn't ready for answers.",
  ALREADY_FINISHED: "This assessment has already been submitted.",
  EXPIRED: "This assessment has expired. Your saved answers will be scored.",
  ALREADY_ANSWERED: "This question has already been answered. Saved answers can't be changed.",
  INVALID_ANSWER: "Choose one of the listed answers.",
  SCORING_FAILED:
    "Some answers couldn't be scored right now. Your answers are saved — please submit again.",
  AI_UNAVAILABLE: CV_ERROR_MESSAGES.AI_UNAVAILABLE,
  AI_TIMEOUT: CV_ERROR_MESSAGES.AI_TIMEOUT,
  AI_INVALID_OUTPUT: "The AI returned an unexpected result. Please try again.",
  AI_RATE_LIMITED: CV_ERROR_MESSAGES.AI_RATE_LIMITED,
  AI_REFUSED: "The AI service declined this request. Please try again with different settings.",
  GENERATION_INTERRUPTED: "Generating this assessment was interrupted. Please practice again.",
  DATABASE_ERROR: "Something went wrong saving your assessment. Please try again.",
  RATE_LIMITED: CV_ERROR_MESSAGES.RATE_LIMITED,
  ANSWER_RATE_LIMITED:
    "You're submitting answers very quickly. Please wait {minutes} minute(s) and try again.",
  UNKNOWN: CV_ERROR_MESSAGES.UNKNOWN,
} as const;

export type AssessmentErrorCode = keyof typeof ASSESSMENT_ERROR_MESSAGES;

export function assessmentErrorMessage(
  code: string | null | undefined,
  vars: Record<string, string> = {},
) {
  const template =
    code && code in ASSESSMENT_ERROR_MESSAGES
      ? ASSESSMENT_ERROR_MESSAGES[code as AssessmentErrorCode]
      : ASSESSMENT_ERROR_MESSAGES.UNKNOWN;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export class AssessmentError extends Error {
  constructor(
    readonly code: AssessmentErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AssessmentError";
  }
}
