import mammoth from "mammoth";
import { CvError } from "./errors";
import type { RawExtraction } from "./pdf";
import { verifyZipExpansion } from "./zip-guard";

/** Plain text from a DOCX (no HTML is produced or rendered). */
export async function extractDocxText(bytes: Uint8Array): Promise<RawExtraction> {
  // Also checked at upload; repeated here for files stored before that check existed.
  const archive = verifyZipExpansion(bytes);
  if (archive === "exceeds_limit")
    throw new CvError("SUSPICIOUS_ARCHIVE", "DOCX expands beyond the safe limit");
  if (archive === "malformed") throw new CvError("CORRUPT_FILE", "DOCX could not be parsed");
  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: value, pageCount: null };
  } catch {
    throw new CvError("CORRUPT_FILE", "DOCX could not be parsed");
  }
}
