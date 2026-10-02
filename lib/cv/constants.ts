/** Client-safe CV upload rules (the server re-checks everything). */

export const CV_KINDS = {
  pdf: { extension: ".pdf", mimeType: "application/pdf", label: "PDF" },
  docx: {
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "DOCX",
  },
} as const;

export type CvKind = keyof typeof CV_KINDS;

export const DEFAULT_MAX_CV_BYTES = 10 * 1024 * 1024;

/** For the file input's `accept` attribute. */
export const CV_ACCEPT = [
  ...Object.values(CV_KINDS).map((k) => k.extension),
  ...Object.values(CV_KINDS).map((k) => k.mimeType),
].join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

export function cvKindFromMime(mimeType: string): CvKind | null {
  const entry = Object.entries(CV_KINDS).find(([, k]) => k.mimeType === mimeType);
  return entry ? (entry[0] as CvKind) : null;
}
