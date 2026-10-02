"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validationFailure, type ActionResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/session";
import { getMyJobAnalysisStatus } from "@/lib/data/job-match";
import { JobMatchError, jobMatchErrorMessage } from "@/lib/job-match/errors";
import { jobMatchLimiter } from "@/lib/job-match/rate-limits";
import { createJobMatch, deleteJobMatch, requestJobReanalysis } from "@/lib/job-match/service";
import { jobMatchInputSchema } from "@/lib/job-match/validation";

// Ids come from the browser: validate their shape; ownership is checked in every query.
const idSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+$/i);

function rateLimited(retryAfterSeconds: number) {
  return {
    ok: false as const,
    error: jobMatchErrorMessage("RATE_LIMITED", {
      minutes: String(Math.max(1, Math.ceil(retryAfterSeconds / 60))),
    }),
  };
}

function failure(error: unknown) {
  if (error instanceof JobMatchError) {
    return { ok: false as const, error: jobMatchErrorMessage(error.code) };
  }
  console.error("[job-match] action failed with an unexpected error");
  return { ok: false as const, error: jobMatchErrorMessage("DATABASE_ERROR") };
}

type StartResult =
  | { ok: true; jobId: string; analysisId: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export async function createJobMatchAction(input: unknown): Promise<StartResult> {
  const user = await requireUser();
  const parsed = jobMatchInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error) as StartResult;

  const limit = await jobMatchLimiter(user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  try {
    const started = await createJobMatch(user.id, parsed.data);
    revalidatePath("/dashboard/job-match");
    return { ok: true, jobId: started.jobId, analysisId: started.analysisId };
  } catch (error) {
    const result = failure(error);
    // CV problems belong to the CV field.
    if (error instanceof JobMatchError && error.code.startsWith("CV_")) {
      return { ok: false, fieldErrors: { cvId: result.error } };
    }
    return result;
  }
}

export async function reanalyzeJobMatchAction(
  jobId: unknown,
): Promise<{ ok: true; analysisId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const id = idSchema.safeParse(jobId);
  if (!id.success) return { ok: false, error: jobMatchErrorMessage("MATCH_NOT_FOUND") };

  const limit = await jobMatchLimiter(user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  try {
    const started = await requestJobReanalysis(user.id, id.data);
    revalidatePath("/dashboard/job-match");
    return { ok: true, analysisId: started.analysisId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteJobMatchAction(jobId: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const id = idSchema.safeParse(jobId);
  if (!id.success) return { ok: false, error: jobMatchErrorMessage("MATCH_NOT_FOUND") };

  try {
    const deleted = await deleteJobMatch(user.id, id.data);
    if (!deleted) return { ok: false, error: jobMatchErrorMessage("MATCH_NOT_FOUND") };
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/job-match");
  return { ok: true };
}

export type JobAnalysisStatusResult =
  | {
      ok: true;
      status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
      stage: "QUEUED" | "ANALYZING" | "FINALIZING";
    }
  | { ok: false; error: string };

export async function getJobAnalysisStatusAction(
  analysisId: unknown,
): Promise<JobAnalysisStatusResult> {
  const id = idSchema.safeParse(analysisId);
  if (!id.success) return { ok: false, error: jobMatchErrorMessage("MATCH_NOT_FOUND") };
  const run = await getMyJobAnalysisStatus(id.data);
  if (!run) return { ok: false, error: jobMatchErrorMessage("MATCH_NOT_FOUND") };
  return { ok: true, status: run.status, stage: run.stage };
}
