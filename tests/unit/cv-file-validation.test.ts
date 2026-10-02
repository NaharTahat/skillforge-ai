import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CV_KINDS } from "@/lib/cv/constants";
import { extensionOf, inspectZip, validateCvFile } from "@/lib/cv/file-validation";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../fixtures/cv/${name}`, import.meta.url)));

const MAX = 10 * 1024 * 1024;
const PDF_MIME = CV_KINDS.pdf.mimeType;
const DOCX_MIME = CV_KINDS.docx.mimeType;

function validate(fileName: string, bytes: Uint8Array, declaredMimeType = "") {
  return validateCvFile({ fileName, bytes, declaredMimeType, maxBytes: MAX });
}

describe("validateCvFile", () => {
  it("accepts a real PDF and DOCX, deciding the MIME type from content", () => {
    expect(validate("cv.pdf", fixture("sample-cv.pdf"), PDF_MIME)).toEqual({
      ok: true,
      kind: "pdf",
      mimeType: PDF_MIME,
    });
    expect(validate("CV.DOCX", fixture("sample-cv.docx"), "")).toEqual({
      ok: true,
      kind: "docx",
      mimeType: DOCX_MIME,
    });
  });

  it("rejects empty and oversized files", () => {
    expect(validate("cv.pdf", new Uint8Array())).toEqual({ ok: false, code: "EMPTY_FILE" });
    const big = validateCvFile({
      fileName: "cv.pdf",
      bytes: fixture("sample-cv.pdf"),
      declaredMimeType: PDF_MIME,
      maxBytes: 100,
    });
    expect(big).toEqual({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it.each(["cv.exe", "cv.html", "cv.svg", "cv.docm", "cv.pdf.exe", "cv", "cv.doc"])(
    "rejects unsupported extension %s",
    (name) => {
      expect(validate(name, fixture("sample-cv.pdf"))).toEqual({
        ok: false,
        code: "UNSUPPORTED_EXTENSION",
      });
    },
  );

  it("rejects a declared MIME type that contradicts the extension", () => {
    expect(validate("cv.pdf", fixture("sample-cv.pdf"), "text/html")).toEqual({
      ok: false,
      code: "UNSUPPORTED_MIME",
    });
    expect(validate("cv.docx", fixture("sample-cv.docx"), PDF_MIME)).toEqual({
      ok: false,
      code: "UNSUPPORTED_MIME",
    });
  });

  it("does not trust the extension or MIME claim over the bytes", () => {
    expect(validate("cv.pdf", fixture("not-a-pdf.pdf"), PDF_MIME)).toEqual({
      ok: false,
      code: "SIGNATURE_MISMATCH",
    });
    expect(validate("cv.docx", fixture("sample-cv.pdf"), DOCX_MIME)).toEqual({
      ok: false,
      code: "SIGNATURE_MISMATCH",
    });
    expect(validate("cv.pdf", fixture("sample-cv.docx"), PDF_MIME)).toEqual({
      ok: false,
      code: "SIGNATURE_MISMATCH",
    });
  });

  it("rejects macro-enabled documents disguised as .docx", () => {
    expect(validate("cv.docx", fixture("macro.docx"), DOCX_MIME)).toEqual({
      ok: false,
      code: "MACRO_DOCUMENT",
    });
  });

  it("rejects a ZIP that is not a Word document", () => {
    // A valid DOCX with the document part renamed away.
    const bytes = fixture("sample-cv.docx");
    const text = Buffer.from(bytes)
      .toString("latin1")
      .replaceAll("word/document.xml", "word/documenX.xml");
    expect(validate("cv.docx", new Uint8Array(Buffer.from(text, "latin1")))).toEqual({
      ok: false,
      code: "SIGNATURE_MISMATCH",
    });
  });
});

describe("inspectZip", () => {
  it("lists entries and declared sizes without decompressing", () => {
    const info = inspectZip(fixture("sample-cv.docx"));
    // Three files plus the "_rels/" and "word/" directory entries.
    expect([...info!.names].sort()).toEqual(
      ["[Content_Types].xml", "_rels/", "_rels/.rels", "word/", "word/document.xml"].sort(),
    );
    expect(info?.entries).toBe(5);
    expect(info!.uncompressedBytes).toBeGreaterThan(0);
  });

  it("returns null for truncated archives", () => {
    const bytes = fixture("sample-cv.docx");
    expect(inspectZip(bytes.subarray(0, bytes.length - 30))).toBeNull();
  });
});

describe("extensionOf", () => {
  it("uses only the final extension, case-insensitively", () => {
    expect(extensionOf("My CV.Final.PDF")).toBe(".pdf");
    expect(extensionOf("resume.pdf.exe")).toBe(".exe");
    expect(extensionOf("noextension")).toBe("");
    expect(extensionOf("../../etc/passwd")).toBe("");
  });
});
