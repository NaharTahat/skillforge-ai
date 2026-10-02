import { CV_KINDS, type CvKind } from "./constants";
import { verifyZipExpansion } from "./zip-guard";

/**
 * Upload validation. The browser's MIME type and filename are treated as
 * claims; the decision is based on the bytes. Pure and synchronous (testable).
 */

export type FileValidationCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_EXTENSION"
  | "UNSUPPORTED_MIME"
  | "SIGNATURE_MISMATCH"
  | "MACRO_DOCUMENT"
  | "SUSPICIOUS_ARCHIVE";

export type FileValidationResult =
  { ok: true; kind: CvKind; mimeType: string } | { ok: false; code: FileValidationCode };

// Browsers send "" or octet-stream for DOCX on some platforms; the signature decides.
const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);

// Limits for DOCX (ZIP) contents, checked before any parser decompresses them.
const ZIP_MAX_ENTRIES = 1_000;
const ZIP_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const ZIP_MAX_RATIO = 200;

export function extensionOf(fileName: string): string {
  const match = /\.[^.\\/]+$/.exec(fileName.trim().toLowerCase());
  return match ? match[0] : "";
}

export function validateCvFile(input: {
  fileName: string;
  declaredMimeType: string;
  bytes: Uint8Array;
  maxBytes: number;
}): FileValidationResult {
  const { fileName, bytes, maxBytes } = input;
  const declared = input.declaredMimeType.trim().toLowerCase();

  if (bytes.length === 0) return { ok: false, code: "EMPTY_FILE" };
  if (bytes.length > maxBytes) return { ok: false, code: "FILE_TOO_LARGE" };

  const kind = (Object.keys(CV_KINDS) as CvKind[]).find(
    (k) => CV_KINDS[k].extension === extensionOf(fileName),
  );
  if (!kind) return { ok: false, code: "UNSUPPORTED_EXTENSION" };

  if (!GENERIC_MIME_TYPES.has(declared) && declared !== CV_KINDS[kind].mimeType) {
    return { ok: false, code: "UNSUPPORTED_MIME" };
  }

  if (kind === "pdf") {
    return isPdf(bytes)
      ? { ok: true, kind, mimeType: CV_KINDS.pdf.mimeType }
      : { ok: false, code: "SIGNATURE_MISMATCH" };
  }

  if (!isZip(bytes)) return { ok: false, code: "SIGNATURE_MISMATCH" };
  const archive = inspectZip(bytes);
  if (!archive) return { ok: false, code: "SUSPICIOUS_ARCHIVE" };
  if (!archive.names.has("word/document.xml") || !archive.names.has("[Content_Types].xml")) {
    return { ok: false, code: "SIGNATURE_MISMATCH" };
  }
  if ([...archive.names].some((n) => n.toLowerCase().endsWith("vbaproject.bin"))) {
    return { ok: false, code: "MACRO_DOCUMENT" };
  }
  if (
    archive.entries > ZIP_MAX_ENTRIES ||
    archive.uncompressedBytes > ZIP_MAX_UNCOMPRESSED_BYTES ||
    archive.uncompressedBytes > bytes.length * ZIP_MAX_RATIO
  ) {
    return { ok: false, code: "SUSPICIOUS_ARCHIVE" };
  }
  // Declared sizes can be forged: inflate for real, with a hard output cap.
  if (verifyZipExpansion(bytes) !== "ok") return { ok: false, code: "SUSPICIOUS_ARCHIVE" };
  return { ok: true, kind, mimeType: CV_KINDS.docx.mimeType };
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((b, i) => bytes[i] === b);
}

/** "%PDF-" */
export function isPdf(bytes: Uint8Array) {
  return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

/** "PK\x03\x04" (local file header) */
export function isZip(bytes: Uint8Array) {
  return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
}

/**
 * Reads the ZIP central directory (no decompression) to list entry names and
 * the declared uncompressed size. Returns null for malformed or ZIP64 archives.
 */
export function inspectZip(
  bytes: Uint8Array,
): { names: Set<string>; entries: number; uncompressedBytes: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_SIGNATURE = 0x02014b50;

  // End of central directory: 22 bytes + up to 64 KiB comment, at the end.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || cdOffset === 0xffffffff || cdOffset >= bytes.length) return null;

  const decoder = new TextDecoder();
  const names = new Set<string>();
  let uncompressedBytes = 0;
  let offset = cdOffset;

  for (let n = 0; n < entries; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      return null;
    }
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (size === 0xffffffff || offset + 46 + nameLength > bytes.length) return null;

    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name.includes("..") || name.startsWith("/")) return null;
    names.add(name);
    uncompressedBytes += size;
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return { names, entries, uncompressedBytes };
}
