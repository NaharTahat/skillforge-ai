import { extractText, getDocumentProxy } from "unpdf";
import { CvError } from "./errors";

export type RawExtraction = { text: string; pageCount: number | null };

/** Text from a PDF's text layer (no OCR). Encrypted or malformed files → CORRUPT_FILE. */
export async function extractPdfText(bytes: Uint8Array): Promise<RawExtraction> {
  let document: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    // pdf.js may transfer the buffer it's given, so hand it a copy.
    document = await getDocumentProxy(bytes.slice());
    const { totalPages, text } = await extractText(document, { mergePages: true });
    return { text, pageCount: totalPages };
  } catch {
    throw new CvError("CORRUPT_FILE", "PDF could not be parsed");
  } finally {
    await document?.cleanup().catch(() => undefined);
  }
}
