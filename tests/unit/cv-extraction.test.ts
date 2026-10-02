import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CvError } from "@/lib/cv/errors";
import { extractCvText, normalizeText } from "@/lib/cv/extractor";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../fixtures/cv/${name}`, import.meta.url)));

async function extractionError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof CvError ? error.code : `unexpected: ${String(error)}`;
  }
  return "no error";
}

describe("extractCvText", () => {
  it("extracts text and page count from a text-based PDF", async () => {
    const { text, metadata } = await extractCvText(fixture("sample-cv.pdf"), "pdf");
    expect(text).toContain("Jordan Rivera");
    expect(text).toContain("scikit-learn churn model");
    expect(metadata).toMatchObject({ kind: "pdf", pageCount: 1, truncated: false });
    expect(metadata.wordCount).toBeGreaterThan(50);
  });

  it("extracts text from a DOCX", async () => {
    const { text, metadata } = await extractCvText(fixture("sample-cv.docx"), "docx");
    expect(text).toContain("Built Python and SQL pipelines");
    expect(metadata).toMatchObject({ kind: "docx", pageCount: null, truncated: false });
  });

  it("asks for OCR when a PDF has pages but no text layer", async () => {
    expect(await extractionError(extractCvText(fixture("scanned.pdf"), "pdf"))).toBe("NEEDS_OCR");
  });

  it("reports corrupted files", async () => {
    expect(await extractionError(extractCvText(fixture("corrupt.pdf"), "pdf"))).toBe(
      "CORRUPT_FILE",
    );
    const brokenDocx = fixture("sample-cv.docx").subarray(0, 200);
    expect(await extractionError(extractCvText(brokenDocx, "docx"))).toBe("CORRUPT_FILE");
  });

  it("reports empty and too-short documents", async () => {
    expect(await extractionError(extractCvText(fixture("empty.docx"), "docx"))).toBe("NO_TEXT");
    expect(await extractionError(extractCvText(fixture("short.docx"), "docx"))).toBe(
      "TOO_LITTLE_TEXT",
    );
  });
});

describe("normalizeText", () => {
  it("collapses layout whitespace and control characters but keeps lines", () => {
    expect(normalizeText("  Name\t\t Surname \r\n\r\n\r\n\r\nSkills:\u0000 Python  ")).toBe(
      "Name Surname\n\nSkills: Python",
    );
  });
});
