"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getMyInterviewStatus } from "@/lib/data/interview";
import { InterviewError, interviewErrorMessage } from "@/lib/interview/errors";
import { answerSubmissionLimiter, interviewGenerationLimiter } from "@/lib/interview/rate-limits";
import {
  completeInterview,
  createInterview,
  deleteInterview,
  practiceAgain,
  retryEvaluation,
  skipQuestion,
  submitAnswer,
} from "@/lib/interview/service";
import {
  createInterviewSchema,
  idSchema,
  questionActionSchema,
  submitAnswerSchema,
} from "@/lib/interview/validation";

/**
 * Interview server actions. The user always comes from the session; any
 * userId in the request is ignored. Errors become safe, friendly messages.
 */

type Fail = { ok: false; error: string };

function failure(error: unknown): Fail {
  if (error instanceof InterviewError)
    return { ok: false, error: interviewErrorMessage(error.code) };
  console.error("[interview] action failed with an unexpected error");
  return { ok: false, error: interviewErrorMessage("DATABASE_ERROR") };
}

const minutes = (seconds: number) => String(Math.max(1, Math.ceil(seconds / 60)));

export async function createInterviewAction(
  input: unknown,
): Promise<{ ok: true; interviewId: string } | Fail> {
  const user = await requireUser();
  const parsed = createInterviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: interviewErrorMessage("INVALID_CONFIG") };

  const limit = await interviewGenerationLimiter(user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: interviewErrorMessage("RATE_LIMITED", { minutes: minutes(limit.retryAfterSeconds) }),
    };
  }
  try {
    const started = await createInterview(user.id, parsed.data);
    revalidatePath("/dashboard/interview");
    return { ok: true, interviewId: started.interviewId };
  } catch (error) {
    return failure(error);
  }
}

export async function practiceAgainAction(
  interviewId: unknown,
): Promise<{ ok: true; interviewId: string } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(interviewId);
  if (!id.success) return { ok: false, error: interviewErrorMessage("INTERVIEW_NOT_FOUND") };
  const limit = await interviewGenerationLimiter(user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: interviewErrorMessage("RATE_LIMITED", { minutes: minutes(limit.retryAfterSeconds) }),
    };
  }
  try {
    const started = await practiceAgain(user.id, id.data);
    revalidatePath("/dashboard/interview");
    return { ok: true, interviewId: started.interviewId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteInterviewAction(interviewId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(interviewId);
  if (!id.success) return { ok: false, error: interviewErrorMessage("INTERVIEW_NOT_FOUND") };
  try {
    if (!(await deleteInterview(user.id, id.data))) {
      return { ok: false, error: interviewErrorMessage("INTERVIEW_NOT_FOUND") };
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/interview");
  return { ok: true };
}

/** Saves and evaluates an answer. `evaluated: false` means the answer was saved but feedback failed. */
export async function submitAnswerAction(
  input: unknown,
): Promise<{ ok: true; evaluated: boolean; error?: string } | Fail> {
  const user = await requireUser();
  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "answer");
    return { ok: false, error: issue?.message ?? interviewErrorMessage("QUESTION_NOT_FOUND") };
  }
  const limit = await answerSubmissionLimiter(user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: interviewErrorMessage("ANSWER_RATE_LIMITED", {
        minutes: minutes(limit.retryAfterSeconds),
      }),
    };
  }
  try {
    const result = await submitAnswer(user.id, parsed.data.questionId, parsed.data.answer);
    return result.ok
      ? { ok: true, evaluated: true }
      : { ok: true, evaluated: false, error: interviewErrorMessage(result.code) };
  } catch (error) {
    return failure(error);
  }
}

export async function retryEvaluationAction(
  input: unknown,
): Promise<{ ok: true; evaluated: boolean; error?: string } | Fail> {
  const user = await requireUser();
  const parsed = questionActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: interviewErrorMessage("QUESTION_NOT_FOUND") };
  const limit = await answerSubmissionLimiter(user.id);
  if (!limit.ok) {
    return {
      ok: false,
      error: interviewErrorMessage("ANSWER_RATE_LIMITED", {
        minutes: minutes(limit.retryAfterSeconds),
      }),
    };
  }
  try {
    const result = await retryEvaluation(user.id, parsed.data.questionId);
    return result.ok
      ? { ok: true, evaluated: true }
      : { ok: true, evaluated: false, error: interviewErrorMessage(result.code) };
  } catch (error) {
    return failure(error);
  }
}

export async function skipQuestionAction(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = questionActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: interviewErrorMessage("QUESTION_NOT_FOUND") };
  try {
    await skipQuestion(user.id, parsed.data.questionId);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function completeInterviewAction(interviewId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(interviewId);
  if (!id.success) return { ok: false, error: interviewErrorMessage("INTERVIEW_NOT_FOUND") };
  try {
    await completeInterview(user.id, id.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/interview");
  return { ok: true };
}

export async function getInterviewStatusAction(interviewId: unknown): Promise<
  | {
      ok: true;
      status: "DRAFT" | "GENERATING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
      stage: "PREPARING" | "GENERATING" | "VALIDATING" | "FINALIZING";
    }
  | Fail
> {
  const id = idSchema.safeParse(interviewId);
  if (!id.success) return { ok: false, error: interviewErrorMessage("INTERVIEW_NOT_FOUND") };
  const interview = await getMyInterviewStatus(id.data);
  if (!interview) return { ok: false, error: interviewErrorMessage("INTERVIEW_NOT_FOUND") };
  return { ok: true, status: interview.status, stage: interview.stage };
}
