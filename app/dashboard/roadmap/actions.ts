"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getMyRoadmapStatus } from "@/lib/data/roadmap";
import { RoadmapError, roadmapErrorMessage } from "@/lib/roadmap/errors";
import type { Progress } from "@/lib/roadmap/progress";
import { roadmapLimiter } from "@/lib/roadmap/rate-limits";
import {
  createRoadmap,
  deleteRoadmap,
  regenerateRoadmap,
  updateTaskStatus,
} from "@/lib/roadmap/service";
import { createRoadmapSchema, idSchema, taskStatusUpdateSchema } from "@/lib/roadmap/validation";

type Fail = { ok: false; error: string };

function failure(error: unknown): Fail {
  if (error instanceof RoadmapError) return { ok: false, error: roadmapErrorMessage(error.code) };
  console.error("[roadmap] action failed with an unexpected error");
  return { ok: false, error: roadmapErrorMessage("DATABASE_ERROR") };
}

function rateLimited(retryAfterSeconds: number): Fail {
  return {
    ok: false,
    error: roadmapErrorMessage("RATE_LIMITED", {
      minutes: String(Math.max(1, Math.ceil(retryAfterSeconds / 60))),
    }),
  };
}

export async function createRoadmapAction(
  input: unknown,
): Promise<{ ok: true; roadmapId: string } | Fail> {
  const user = await requireUser();
  const parsed = createRoadmapSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: roadmapErrorMessage("INVALID_SOURCE") };

  const limit = await roadmapLimiter(user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  try {
    const started = await createRoadmap(user.id, parsed.data);
    revalidatePath("/dashboard/roadmap");
    return { ok: true, roadmapId: started.roadmapId };
  } catch (error) {
    return failure(error);
  }
}

export async function regenerateRoadmapAction(
  roadmapId: unknown,
): Promise<{ ok: true; roadmapId: string } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(roadmapId);
  if (!id.success) return { ok: false, error: roadmapErrorMessage("ROADMAP_NOT_FOUND") };

  const limit = await roadmapLimiter(user.id);
  if (!limit.ok) return rateLimited(limit.retryAfterSeconds);

  try {
    const started = await regenerateRoadmap(user.id, id.data);
    revalidatePath("/dashboard/roadmap");
    return { ok: true, roadmapId: started.roadmapId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRoadmapAction(roadmapId: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(roadmapId);
  if (!id.success) return { ok: false, error: roadmapErrorMessage("ROADMAP_NOT_FOUND") };
  try {
    if (!(await deleteRoadmap(user.id, id.data))) {
      return { ok: false, error: roadmapErrorMessage("ROADMAP_NOT_FOUND") };
    }
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/roadmap");
  return { ok: true };
}

/** No AI call and no generation rate limit: progress tracking only. */
export async function updateTaskStatusAction(
  input: unknown,
): Promise<{ ok: true; progress: Progress } | Fail> {
  const user = await requireUser();
  const parsed = taskStatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: roadmapErrorMessage("TASK_NOT_FOUND") };
  try {
    const progress = await updateTaskStatus(user.id, parsed.data.taskId, parsed.data.status);
    return { ok: true, progress };
  } catch (error) {
    return failure(error);
  }
}

export async function getRoadmapStatusAction(roadmapId: unknown): Promise<
  | {
      ok: true;
      status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
      stage: "QUEUED" | "ANALYZING" | "FINALIZING";
    }
  | Fail
> {
  const id = idSchema.safeParse(roadmapId);
  if (!id.success) return { ok: false, error: roadmapErrorMessage("ROADMAP_NOT_FOUND") };
  const roadmap = await getMyRoadmapStatus(id.data);
  if (!roadmap) return { ok: false, error: roadmapErrorMessage("ROADMAP_NOT_FOUND") };
  return { ok: true, status: roadmap.status, stage: roadmap.stage };
}
