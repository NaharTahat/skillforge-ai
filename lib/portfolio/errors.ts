import { CV_ERROR_MESSAGES } from "@/lib/cv/errors";

/** User-facing portfolio messages. Nothing internal reaches the client. */
export const PORTFOLIO_ERROR_MESSAGES = {
  NOT_FOUND: "This item doesn't exist or you don't have access to it.",
  PROJECT_NOT_FOUND: "This project doesn't exist or you don't have access to it.",
  SKILL_NOT_FOUND: "That skill isn't in your skill list.",
  SKILL_EXISTS: "This skill is already in your list.",
  USERNAME_TAKEN: "That username is already taken. Try another one.",
  USERNAME_REQUIRED: "Choose a username before making your portfolio public.",
  INVALID_INPUT: "Please check the highlighted fields.",
  NOTHING_TO_GENERATE: "Add a little information first — the AI only uses what you've provided.",
  AI_UNAVAILABLE: CV_ERROR_MESSAGES.AI_UNAVAILABLE,
  AI_TIMEOUT: CV_ERROR_MESSAGES.AI_TIMEOUT,
  AI_INVALID_OUTPUT: "The AI returned an unexpected result. Please try again.",
  AI_RATE_LIMITED: CV_ERROR_MESSAGES.AI_RATE_LIMITED,
  AI_REFUSED: "The AI service declined this request. Please try again.",
  RATE_LIMITED: CV_ERROR_MESSAGES.RATE_LIMITED,
  DATABASE_ERROR: "Something went wrong saving your portfolio. Please try again.",
  UNKNOWN: CV_ERROR_MESSAGES.UNKNOWN,
} as const;

export type PortfolioErrorCode = keyof typeof PORTFOLIO_ERROR_MESSAGES;

export function portfolioErrorMessage(
  code: string | null | undefined,
  vars: Record<string, string> = {},
) {
  const template =
    code && code in PORTFOLIO_ERROR_MESSAGES
      ? PORTFOLIO_ERROR_MESSAGES[code as PortfolioErrorCode]
      : PORTFOLIO_ERROR_MESSAGES.UNKNOWN;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

export class PortfolioError extends Error {
  constructor(
    readonly code: PortfolioErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PortfolioError";
  }
}
