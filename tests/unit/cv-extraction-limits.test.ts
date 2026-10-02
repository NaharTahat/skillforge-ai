import { describe, expect, it, vi } from "vitest";

// Simulate parsers returning extreme output, independent of real files.
const docxText = vi.hoisted(() => ({ value: "" }));
vi.mock("@/lib/cv/docx", () => ({
  extractDocxText: async () => ({ text: docxText.value, pageCount: null }),
}));

import { extractCvText, MAX_CV_TEXT_CHARS } from "@/lib/cv/extractor";

describe("extractCvText limits", () => {
  it("truncates very large text and flags it", async () => {
    docxText.value = "experience python sql ".repeat(10_000);
    const { text, metadata } = await extractCvText(new Uint8Array([1]), "docx");
    expect(text.length).toBe(MAX_CV_TEXT_CHARS);
    expect(metadata.truncated).toBe(true);
  });

  it("does not truncate normal CVs", async () => {
    docxText.value = "word ".repeat(400);
    const { metadata } = await extractCvText(new Uint8Array([1]), "docx");
    expect(metadata.truncated).toBe(false);
    expect(metadata.wordCount).toBe(400);
  });
});
