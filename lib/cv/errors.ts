/**
 * User-facing messages for every CV failure code. Internal details (stack
 * traces, provider responses, paths) never reach the client — only these.
 */
export const CV_ERROR_MESSAGES = {
  // Upload validation
  EMPTY_FILE: "This file is empty. Choose a CV that contains text.",
  FILE_TOO_LARGE: "This file is too large. The maximum size is {max}.",
  UNSUPPORTED_EXTENSION: "Unsupported file type. Upload a PDF or DOCX file.",
  UNSUPPORTED_MIME: "Unsupported file type. Upload a PDF or DOCX file.",
  SIGNATURE_MISMATCH:
    "This file doesn't look like a valid PDF or DOCX. It may be renamed or damaged.",
  MACRO_DOCUMENT: "Documents with macros aren't accepted. Save your CV as a regular .docx or PDF.",
  SUSPICIOUS_ARCHIVE: "This DOCX file couldn't be processed safely. Try exporting it again.",
  // Extraction
  CORRUPT_FILE: "We couldn't read this file. It may be damaged or password-protected.",
  NO_TEXT: "We couldn't find any text in this CV.",
  NEEDS_OCR:
    "This PDF appears to be scanned images with no selectable text. Text recognition (OCR) isn't supported yet — upload a text-based PDF or DOCX.",
  TOO_LITTLE_TEXT: "This document has too little text to analyze as a CV.",
  EXTRACTION_TIMEOUT: "Reading this file took too long. Try a simpler export of your CV.",
  // Analysis
  AI_UNAVAILABLE: "The analysis service is unavailable right now. Please try again later.",
  AI_TIMEOUT: "The analysis took too long and was stopped. Please try again.",
  AI_INVALID_RESPONSE:
    "The analysis service returned an unusable result. No report was saved — please try again.",
  AI_RATE_LIMITED: "The analysis service is busy. Please try again in a few minutes.",
  AI_REFUSED: "The analysis service declined to analyze this document.",
  ANALYSIS_INTERRUPTED: "This analysis was interrupted before it finished. Please run it again.",
  // Infrastructure
  STORAGE_ERROR: "We couldn't store your file. Please try again.",
  DATABASE_ERROR: "Something went wrong saving your CV. Please try again.",
  RATE_LIMITED: "You've reached the limit for now. Please try again in {minutes} minutes.",
  UNKNOWN: "Something went wrong. Please try again.",
} as const;

export type CvErrorCode = keyof typeof CV_ERROR_MESSAGES;

export function cvErrorMessage(code: string | null | undefined, vars: Record<string, string> = {}) {
  const template =
    code && code in CV_ERROR_MESSAGES
      ? CV_ERROR_MESSAGES[code as CvErrorCode]
      : CV_ERROR_MESSAGES.UNKNOWN;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? "");
}

/** Error carrying only a safe code; the message is internal. */
export class CvError extends Error {
  constructor(
    readonly code: CvErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CvError";
  }
}
