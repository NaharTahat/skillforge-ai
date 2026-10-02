import { getCurrentUser } from "@/lib/auth/session";
import { formatBytes } from "@/lib/cv/constants";
import { CvError, cvErrorMessage, type CvErrorCode } from "@/lib/cv/errors";
import { cvUploadLimiter } from "@/lib/cv/rate-limits";
import { ingestCvUpload, maxUploadBytes } from "@/lib/cv/service";
import { logSecurityEvent } from "@/lib/security/audit-log";
import { isSameOriginRequest } from "@/lib/security/request";

// Analysis continues in after() once the response is sent.
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

function failure(status: number, code: CvErrorCode, vars?: Record<string, string>) {
  return Response.json(
    { error: { code, message: cvErrorMessage(code, vars) } },
    { status, headers: NO_STORE },
  );
}

/** Upload a CV (multipart field "file"). Starts an analysis and returns its ids. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    logSecurityEvent("request.cross_origin_rejected", { route: "/api/cv" });
    return failure(403, "UNKNOWN");
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: NO_STORE });
  }

  const limit = await cvUploadLimiter(user.id);
  if (!limit.ok) {
    return failure(429, "RATE_LIMITED", {
      minutes: String(Math.max(1, Math.ceil(limit.retryAfterSeconds / 60))),
    });
  }

  const maxBytes = maxUploadBytes();
  const tooLarge = () => failure(413, "FILE_TOO_LARGE", { max: formatBytes(maxBytes) });
  // Reject oversized bodies before buffering them (64 KiB allowance for multipart framing).
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes + 64 * 1024) return tooLarge();

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return failure(400, "UNSUPPORTED_EXTENSION");
  }
  if (!(file instanceof File)) return failure(400, "EMPTY_FILE");
  if (file.size > maxBytes) return tooLarge();

  try {
    const result = await ingestCvUpload({
      userId: user.id,
      fileName: file.name,
      declaredMimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json(result, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof CvError) {
      const status =
        error.code === "FILE_TOO_LARGE"
          ? 413
          : error.code === "STORAGE_ERROR" || error.code === "DATABASE_ERROR"
            ? 500
            : 422;
      return failure(status, error.code, { max: formatBytes(maxBytes) });
    }
    console.error("[cv] upload failed with an unexpected error");
    return failure(500, "UNKNOWN");
  }
}
