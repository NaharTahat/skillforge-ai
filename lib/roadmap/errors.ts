import { CV_ERROR_MESSAGES } from "@/lib/cv/errors";

/** User-facing roadmap messages. Nothing internal ever reaches the client. */
export const ROADMAP_ERROR_MESSAGES = {
  NO_CV: "Analyze your CV first to create a personalized roadmap.",
  CV_NOT_ANALYZED: "Finish your CV analysis first.",
  CV_NOT_FOUND: "That CV isn't available. Choose one of your analyzed CVs.",
  NO_CAREER_GOAL: "Set a career goal in your profile first.",
  JOB_MATCH_NOT_FOUND: "That job match isn't available. Choose one of your completed job matches.",
  JOB_MATCH_NOT_READY:
    "This job match hasn't finished yet. Create a roadmap once its report is ready.",
  SOURCE_DELETED:
    "A source used for this roadmap (CV or job match) has been deleted. Create a new roadmap instead.",
  INVALID_SOURCE: "Choose a valid source for your roadmap.",
  ROADMAP_NOT_FOUND: "This roadmap doesn't exist or you don't have access to it.",
  TASK_NOT_FOUND: "This task doesn't exist or you don't have access to it.",
  TASK_LOCKED: "Complete this task's prerequisites first.",
  ROADMAP_NOT_READY: "This roadmap is still being generated.",
  AI_UNAVAILABLE: CV_ERROR_MESSAGES.AI_UNAVAILABLE,
  AI_TIMEOUT: CV_ERROR_MESSAGES.AI_TIMEOUT,
  AI_INVALID_RESPONSE: CV_ERROR_MESSAGES.AI_INVALID_RESPONSE,
  AI_RATE_LIMITED: CV_ERROR_MESSAGES.AI_RATE_LIMITED,
  AI_REFUSED: CV_ERROR_MESSAGES.AI_REFUSED,
  ANALYSIS_INTERRUPTED: "Generating this roadmap was interrupted. Please re-generate it.",
  DATABASE_ERROR: "Something went wrong saving your roadmap. Please try again.",
  RATE_LIMITED: CV_ERROR_MESSAGES.RATE_LIMITED,
  UNKNOWN: CV_ERROR_MESSAGES.UNKNOWN,
} as const;

export type RoadmapErrorCode = keyof typeof ROADMAP_ERROR_MESSAGES;

export function roadmapErrorMessage(
  code: string | null | undefined,
  vars: Record<string, string> = {},
) {
  const template =
    code && code in ROADMAP_ERROR_MESSAGES
      ? ROADMAP_ERROR_MESSAGES[code as RoadmapErrorCode]
      : ROADMAP_ERROR_MESSAGES.UNKNOWN;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export class RoadmapError extends Error {
  constructor(
    readonly code: RoadmapErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RoadmapError";
  }
}
