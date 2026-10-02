import { CV_ERROR_MESSAGES } from "@/lib/cv/errors";

/**
 * User-facing messages for Job Match failures. AI failure messages are shared
 * with the CV Analyzer; nothing internal (provider errors, prompts, stack
 * traces) ever reaches the client.
 */
export const JOB_MATCH_ERROR_MESSAGES = {
  CV_NOT_FOUND: "That CV isn't available. Choose one of your CVs.",
  CV_NOT_ANALYZED: "Analyze this CV first, then run a job match.",
  CV_DELETED:
    "The CV used for this match has been deleted. Start a new match with one of your current CVs.",
  MATCH_NOT_FOUND: "This job match doesn't exist or you don't have access to it.",
  AI_UNAVAILABLE: CV_ERROR_MESSAGES.AI_UNAVAILABLE,
  AI_TIMEOUT: CV_ERROR_MESSAGES.AI_TIMEOUT,
  AI_INVALID_RESPONSE: CV_ERROR_MESSAGES.AI_INVALID_RESPONSE,
  AI_RATE_LIMITED: CV_ERROR_MESSAGES.AI_RATE_LIMITED,
  AI_REFUSED: CV_ERROR_MESSAGES.AI_REFUSED,
  ANALYSIS_INTERRUPTED: CV_ERROR_MESSAGES.ANALYSIS_INTERRUPTED,
  DATABASE_ERROR: "Something went wrong saving your job match. Please try again.",
  RATE_LIMITED: CV_ERROR_MESSAGES.RATE_LIMITED,
  UNKNOWN: CV_ERROR_MESSAGES.UNKNOWN,
} as const;

export type JobMatchErrorCode = keyof typeof JOB_MATCH_ERROR_MESSAGES;

export function jobMatchErrorMessage(
  code: string | null | undefined,
  vars: Record<string, string> = {},
) {
  const template =
    code && code in JOB_MATCH_ERROR_MESSAGES
      ? JOB_MATCH_ERROR_MESSAGES[code as JobMatchErrorCode]
      : JOB_MATCH_ERROR_MESSAGES.UNKNOWN;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export class JobMatchError extends Error {
  constructor(
    readonly code: JobMatchErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "JobMatchError";
  }
}
