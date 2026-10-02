import type { CvKind } from "./constants";
import { extractDocxText } from "./docx";
import { CvError } from "./errors";
import { extractPdfText, type RawExtraction } from "./pdf";

/** Upper bound on text kept for analysis; real CVs are far below this. */
export const MAX_CV_TEXT_CHARS = 50_000;
/** Below this, a document isn't a CV we can meaningfully analyze. */
export const MIN_CV_WORDS = 25;
const EXTRACTION_TIMEOUT_MS = 20_000;
const SCANNED_CHARS_PER_PAGE = 60;

export type ExtractionResult = {
  text: string;
  metadata: {
    kind: CvKind;
    pageCount: number | null;
    characterCount: number;
    wordCount: number;
    truncated: boolean;
  };
};

const extractors: Record<CvKind, (bytes: Uint8Array) => Promise<RawExtraction>> = {
  pdf: extractPdfText,
  docx: extractDocxText,
};

/** Collapses layout whitespace while keeping line structure (headings, bullets). */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CvError("EXTRACTION_TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The single entry point for CV text extraction. Callers don't know or care
 * which parser runs. Throws CvError with a user-safe code on failure.
 */
export async function extractCvText(bytes: Uint8Array, kind: CvKind): Promise<ExtractionResult> {
  const raw = await withTimeout(extractors[kind](bytes), EXTRACTION_TIMEOUT_MS);
  let text = normalizeText(raw.text);

  if (text.length === 0) {
    // A PDF with pages but no text layer is almost always a scan.
    throw new CvError(kind === "pdf" && (raw.pageCount ?? 0) > 0 ? "NEEDS_OCR" : "NO_TEXT");
  }

  const truncated = text.length > MAX_CV_TEXT_CHARS;
  if (truncated) text = text.slice(0, MAX_CV_TEXT_CHARS);

  const wordCount = countWords(text);
  if (wordCount < MIN_CV_WORDS) {
    // Scans often carry a stray line of real text (e.g. a footer); a near-empty
    // text layer across the pages still means the content is images.
    const charsPerPage = raw.pageCount ? text.length / raw.pageCount : Infinity;
    throw new CvError(
      kind === "pdf" && charsPerPage < SCANNED_CHARS_PER_PAGE ? "NEEDS_OCR" : "TOO_LITTLE_TEXT",
    );
  }

  return {
    text,
    metadata: { kind, pageCount: raw.pageCount, characterCount: text.length, wordCount, truncated },
  };
}
