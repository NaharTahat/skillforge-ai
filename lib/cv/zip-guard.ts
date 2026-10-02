import { inflateRawSync } from "node:zlib";

/**
 * Decompression-bomb guard for DOCX (ZIP) files.
 *
 * The sizes a ZIP declares in its headers can be forged, so checking them is
 * not enough: a small upload could still inflate to gigabytes inside the
 * parser. This actually inflates every entry, with Node's `maxOutputLength`
 * capping the output of each one at the remaining budget, so the work and
 * memory are bounded no matter what the headers claim. Zip64, encryption and
 * unknown compression methods are rejected (real CVs never need them).
 */

/** Real DOCX CVs expand to a few MB; 50 MB leaves room for embedded images. */
export const DOCX_MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 1_000;

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const min = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === 0x06054b50) return i;
  }
  return -1;
}

export type ZipCheck = "ok" | "malformed" | "exceeds_limit";

/** "ok" when every entry inflates within `maxTotalBytes` in total. Never throws. */
export function verifyZipExpansion(
  bytes: Uint8Array,
  maxTotalBytes: number = DOCX_MAX_EXPANDED_BYTES,
): ZipCheck {
  if (bytes.length < 22) return "malformed";
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) return "malformed";
  const entries = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  // 0xFFFF / 0xFFFFFFFF mean Zip64 records follow.
  if (entries > MAX_ENTRIES) return "exceeds_limit";
  if (entries === 0xffff || cdOffset === 0xffffffff) return "malformed";

  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < entries; i++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) return "malformed";
    const flags = u16(bytes, p + 8);
    const method = u16(bytes, p + 10);
    const compressedSize = u32(bytes, p + 20);
    const nameLength = u16(bytes, p + 28);
    const extraLength = u16(bytes, p + 30);
    const commentLength = u16(bytes, p + 32);
    const localOffset = u32(bytes, p + 42);
    if (flags & 0x1) return "malformed"; // encrypted
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) return "malformed";

    if (localOffset + 30 > bytes.length || u32(bytes, localOffset) !== 0x04034b50)
      return "malformed";
    const dataStart =
      localOffset + 30 + u16(bytes, localOffset + 26) + u16(bytes, localOffset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) return "malformed";
    const data = bytes.subarray(dataStart, dataEnd);

    const remaining = maxTotalBytes - total;
    if (method === 0) {
      total += data.length;
    } else if (method === 8) {
      try {
        // Throws as soon as the output would exceed the remaining budget.
        total += inflateRawSync(data, { maxOutputLength: Math.max(1, remaining) }).length;
      } catch (error) {
        // RangeError: output over budget (a bomb); anything else: corrupt data.
        return error instanceof RangeError ? "exceeds_limit" : "malformed";
      }
    } else {
      return "malformed";
    }
    if (total > maxTotalBytes) return "exceeds_limit";
    p += 46 + nameLength + extraLength + commentLength;
  }
  return "ok";
}
