"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { cvErrorMessage, type CvErrorCode } from "@/lib/cv/errors";
import { cvAnalysisLimiter } from "@/lib/cv/rate-limits";
import { deleteCv, requestAnalysis } from "@/lib/cv/service";
import { getMyAnalysisStatus } from "@/lib/data/cv";

// Ids come from the browser: validate shape; ownership is checked in every query.
const idSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+$/i);

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function analyzeCvAction(cvId: unknown): Promise<Result<{ analysisId: string }>> {
  const user = await requireUser();
  const id = idSchema.safeParse(cvId);
  if (!id.success) return { ok: false, error: "CV not found." };

  const limit = await cvAnalysisLimiter(user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: cvErrorMessage("RATE_LIMITED", {
        minutes: String(Math.max(1, Math.ceil(limit.retryAfterSeconds / 60))),
      }),
    };
  }

  try {
    const started = await requestAnalysis(user.id, id.data);
    if (!started) return { ok: false, error: "CV not found." };
    revalidatePath("/dashboard/cv");
    return { ok: true, analysisId: started.analysisId };
  } catch {
    return { ok: false, error: cvErrorMessage("DATABASE_ERROR") };
  }
}

export async function deleteCvAction(cvId: unknown): Promise<Result> {
  const user = await requireUser();
  const id = idSchema.safeParse(cvId);
  if (!id.success) return { ok: false, error: "CV not found." };

  try {
    const deleted = await deleteCv(user.id, id.data);
    if (!deleted) return { ok: false, error: "CV not found." };
  } catch {
    return { ok: false, error: cvErrorMessage("DATABASE_ERROR") };
  }
  revalidatePath("/dashboard/cv");
  return { ok: true };
}

export type AnalysisStatusResult = Result<{
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: "QUEUED" | "ANALYZING" | "FINALIZING";
  errorMessage: string | null;
}>;

export async function getAnalysisStatusAction(analysisId: unknown): Promise<AnalysisStatusResult> {
  const id = idSchema.safeParse(analysisId);
  if (!id.success) return { ok: false, error: "Analysis not found." };

  const analysis = await getMyAnalysisStatus(id.data);
  if (!analysis) return { ok: false, error: "Analysis not found." };
  return {
    ok: true,
    status: analysis.status,
    stage: analysis.stage,
    errorMessage:
      analysis.status === "FAILED"
        ? cvErrorMessage((analysis.errorCode ?? "UNKNOWN") as CvErrorCode)
        : null,
  };
}
