"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { AssessmentError, assessmentErrorMessage } from "@/lib/assessment/errors";
import {
  answerSaveLimiter,
  assessmentGenerationLimiter,
  submissionLimiter,
} from "@/lib/assessment/rate-limits";
import {
  createAssessment,
  deleteAssessment,
  practiceAgain,
  saveAnswer,
  startAssessment,
  submitAssessment,
} from "@/lib/assessment/service";
import { createAssessmentSchema, idSchema, saveAnswerSchema } from "@/lib/assessment/validation";
import { getMyAssessmentStatus } from "@/lib/data/assessment";

/**
 * Assessment server actions. The user always comes from the session; any
 * userId in the request is ignored. Scores are never accepted from the browser.
 */

type Fail = { ok: false; error: string };

function failure(error: unknown): Fail {
  if (error instanceof AssessmentError)
    return { ok: false, error: assessmentErrorMessage(error.code) };
  console.error("[assessment] action failed with an unexpected error");
  return { ok: false, error: assessmentErrorMessage("DATABASE_ERROR") };
}

const limited = (code: "RATE_LIMITED" | "ANSWER_RATE_LIMITED", seconds: number): Fail => ({
  ok: false,
  error: assessmentErrorMessage(code, { minutes: String(Math.max(1, Math.ceil(seconds / 60))) }),
});

export async function createAssessmentAction(
  input: unknown,
): Promise<{ ok: true; assessmentId: string } | Fail> {
  const user = await requireUser();
  const parsed = createAssessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: assessmentErrorMessage("INVALID_CONFIG") };
  const limit = await assessmentGenerationLimiter(user.id);
  if (!limit.ok) return limited("RATE_LIMITED", limit.retryAfterSeconds);
  try {
    const started = await createAssessment(user.id, parsed.data);
    revalidatePath("/dashboard/assessments");
    return { ok: true, assessmentId: started.assessmentId };
  } catch (error) {
    return failure(error);
  }
}

export async function practiceAgainAction(
  assessmentId: unknown,
): Promise<{ ok: true; assessmentId: string } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
  const limit = await assessmentGenerationLimiter(user.id);
  if (!limit.ok) return limited("RATE_LIMITED", limit.retryAfterSeconds);
  try {
    const started = await practiceAgain(user.id, id.data);
    revalidatePath("/dashboard/assessments");
    return { ok: true, assessmentId: started.assessmentId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteAssessmentAction(assessmentId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
  try {
    if (!(await deleteAssessment(user.id, id.data))) {
      return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/assessments");
  return { ok: true };
}

export async function startAssessmentAction(assessmentId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
  try {
    await startAssessment(user.id, id.data);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Saves and locks one answer. Whether it was correct is not revealed until results. */
export async function saveAnswerAction(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "response");
    return { ok: false, error: issue?.message ?? assessmentErrorMessage("QUESTION_NOT_FOUND") };
  }
  const limit = await answerSaveLimiter(user.id);
  if (!limit.ok) return limited("ANSWER_RATE_LIMITED", limit.retryAfterSeconds);
  try {
    await saveAnswer(user.id, parsed.data.questionId, parsed.data.response);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function submitAssessmentAction(
  assessmentId: unknown,
): Promise<{ ok: true; status: "COMPLETED" | "EXPIRED" } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
  const limit = await submissionLimiter(user.id);
  if (!limit.ok) return limited("RATE_LIMITED", limit.retryAfterSeconds);
  try {
    const result = await submitAssessment(user.id, id.data);
    revalidatePath("/dashboard/assessments");
    revalidatePath("/dashboard");
    return { ok: true, status: result.status as "COMPLETED" | "EXPIRED" };
  } catch (error) {
    return failure(error);
  }
}

export async function getAssessmentStatusAction(assessmentId: unknown): Promise<
  | {
      ok: true;
      status: "DRAFT" | "GENERATING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "FAILED";
      stage: "PREPARING" | "GENERATING" | "VALIDATING" | "FINALIZING";
    }
  | Fail
> {
  const id = idSchema.safeParse(assessmentId);
  if (!id.success) return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
  const a = await getMyAssessmentStatus(id.data);
  if (!a) return { ok: false, error: assessmentErrorMessage("ASSESSMENT_NOT_FOUND") };
  return { ok: true, status: a.status, stage: a.stage };
}
