import "server-only";
import { after } from "next/server";
import { AIConfigurationError, getAIProvider } from "@/lib/ai/provider";
import { generateRoadmap, type RoadmapGenerationInput } from "@/lib/ai/roadmap";
import { cvAnalysisReportSchema } from "@/lib/cv/analysis-schema";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { jobMatchLabel } from "@/lib/job-match/display";
import { jobMatchReportSchema } from "@/lib/job-match/schema";
import { careerGoalLabel, EXPERIENCE_LEVELS } from "@/lib/profile/options";
import { createKeyedLock } from "@/lib/security/keyed-lock";
import type { TaskStatus } from "./constants";
import { RoadmapError } from "./errors";
import { computeProgress } from "./progress";
import { checkTransition, resolveLocks, type UserSettableStatus } from "./task-status";
import type { CreateRoadmapData } from "./validation";

/**
 * Career Roadmap pipeline. Every entry point takes the owner's id from the
 * session and scopes every query by it. Logs carry ids and error codes only.
 */

const ACTIVE = ["PENDING", "PROCESSING"] as const;
const withLock = createKeyedLock();

const CV_LEVEL_LABELS: Record<string, string> = {
  STUDENT: "Student",
  ENTRY: "Entry level",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
};

function staleAfterMs() {
  return getEnv().AI_TIMEOUT_MS * 2 + 60_000;
}

/** The user's CV with its latest completed analysis id. */
async function requireAnalyzedCv(userId: string, cvId: string) {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: {
      id: true,
      analyses: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!cv) throw new RoadmapError("CV_NOT_FOUND");
  const analysisId = cv.analyses[0]?.id;
  if (!analysisId) throw new RoadmapError("CV_NOT_ANALYZED");
  return { cvId: cv.id, cvAnalysisId: analysisId };
}

/** The user's job match with its latest completed run. */
async function requireCompletedJobMatch(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      title: true,
      company: true,
      analyses: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, cvId: true },
      },
    },
  });
  if (!job) throw new RoadmapError("JOB_MATCH_NOT_FOUND");
  const run = job.analyses[0];
  if (!run) throw new RoadmapError("JOB_MATCH_NOT_READY");
  if (!run.cvId) throw new RoadmapError("SOURCE_DELETED");
  return { job, jobAnalysisId: run.id, cvId: run.cvId };
}

export async function createRoadmap(
  userId: string,
  data: CreateRoadmapData,
): Promise<{ roadmapId: string; reused: boolean }> {
  return withLock(`roadmap:${userId}`, async () => {
    if (data.source === "JOB_MATCH") {
      const { job, jobAnalysisId, cvId } = await requireCompletedJobMatch(userId, data.jobId);
      const cv = await requireAnalyzedCv(userId, cvId);
      const running = await prisma.roadmap.findFirst({
        where: { userId, jobId: job.id, status: { in: [...ACTIVE] } },
        select: { id: true },
      });
      if (running) return { roadmapId: running.id, reused: true };

      const goal = job.title ?? "Untitled job";
      return start({
        userId,
        sourceType: "JOB_MATCH",
        title: `Roadmap to ${goal}`,
        goal,
        cvId: cv.cvId,
        cvAnalysisId: cv.cvAnalysisId,
        jobId: job.id,
        jobAnalysisId,
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { careerGoal: true },
    });
    if (!profile?.careerGoal) throw new RoadmapError("NO_CAREER_GOAL");
    const cv = await requireAnalyzedCv(userId, data.cvId);
    const running = await prisma.roadmap.findFirst({
      where: {
        userId,
        sourceType: "CAREER_GOAL",
        careerGoal: profile.careerGoal,
        cvId: cv.cvId,
        status: { in: [...ACTIVE] },
      },
      select: { id: true },
    });
    if (running) return { roadmapId: running.id, reused: true };

    const goal = careerGoalLabel(profile.careerGoal) ?? "Career goal";
    return start({
      userId,
      sourceType: "CAREER_GOAL",
      title: `Roadmap to ${goal}`,
      goal,
      cvId: cv.cvId,
      cvAnalysisId: cv.cvAnalysisId,
      careerGoal: profile.careerGoal,
      timeframeWeeks: data.timeframeWeeks,
    });
  });
}

/**
 * Generates a new roadmap from the same sources (same job / career goal and
 * CV, using their latest completed analyses). The previous roadmap is kept.
 */
export async function regenerateRoadmap(
  userId: string,
  roadmapId: string,
): Promise<{ roadmapId: string; reused: boolean }> {
  return withLock(`roadmap:${userId}`, async () => {
    const previous = await prisma.roadmap.findFirst({
      where: { id: roadmapId, userId },
      select: {
        id: true,
        sourceType: true,
        title: true,
        goal: true,
        cvId: true,
        jobId: true,
        careerGoal: true,
        timeframeWeeks: true,
      },
    });
    if (!previous) throw new RoadmapError("ROADMAP_NOT_FOUND");

    await expireStaleRoadmaps({ userId });
    const running = await prisma.roadmap.findFirst({
      where: {
        userId,
        status: { in: [...ACTIVE] },
        OR: [
          { id: previous.id },
          { regeneratedFromId: previous.id },
          previous.jobId
            ? { jobId: previous.jobId }
            : { sourceType: "CAREER_GOAL", careerGoal: previous.careerGoal, cvId: previous.cvId },
        ],
      },
      select: { id: true },
    });
    if (running) return { roadmapId: running.id, reused: true };

    if (!previous.cvId) throw new RoadmapError("SOURCE_DELETED");
    const cv = await requireAnalyzedCv(userId, previous.cvId);

    if (previous.sourceType === "JOB_MATCH") {
      if (!previous.jobId) throw new RoadmapError("SOURCE_DELETED");
      const { jobAnalysisId } = await requireCompletedJobMatch(userId, previous.jobId);
      return start({
        userId,
        sourceType: "JOB_MATCH",
        title: previous.title,
        goal: previous.goal,
        cvId: cv.cvId,
        cvAnalysisId: cv.cvAnalysisId,
        jobId: previous.jobId,
        jobAnalysisId,
        regeneratedFromId: previous.id,
      });
    }

    return start({
      userId,
      sourceType: "CAREER_GOAL",
      title: previous.title,
      goal: previous.goal,
      cvId: cv.cvId,
      cvAnalysisId: cv.cvAnalysisId,
      careerGoal: previous.careerGoal,
      timeframeWeeks: previous.timeframeWeeks,
      regeneratedFromId: previous.id,
    });
  });
}

type StartData = {
  userId: string;
  sourceType: "JOB_MATCH" | "CAREER_GOAL";
  title: string;
  goal: string;
  cvId: string;
  cvAnalysisId: string;
  jobId?: string;
  jobAnalysisId?: string;
  careerGoal?: NonNullable<Awaited<ReturnType<typeof prisma.profile.findUnique>>>["careerGoal"];
  timeframeWeeks?: number | null;
  regeneratedFromId?: string;
};

async function start(data: StartData) {
  const roadmap = await prisma.roadmap.create({
    data: { ...data, provider: getEnv().AI_PROVIDER },
    select: { id: true },
  });
  after(() => runRoadmapGeneration(roadmap.id));
  return { roadmapId: roadmap.id, reused: false };
}

async function buildInput(roadmapId: string): Promise<RoadmapGenerationInput> {
  const roadmap = await prisma.roadmap.findUniqueOrThrow({
    where: { id: roadmapId },
    select: {
      sourceType: true,
      goal: true,
      timeframeWeeks: true,
      user: { select: { profile: { select: { experienceLevel: true } } } },
      cv: { select: { fileName: true, extractedText: true, textTruncated: true } },
      cvAnalysis: { select: { result: true } },
      job: { select: { title: true, company: true, description: true } },
      jobAnalysis: { select: { result: true } },
    },
  });
  if (!roadmap.cv || !roadmap.cvAnalysis) throw new RoadmapError("SOURCE_DELETED");
  const cvReport = cvAnalysisReportSchema.safeParse(roadmap.cvAnalysis.result);
  if (!cvReport.success) throw new RoadmapError("SOURCE_DELETED");

  const profileLevel = EXPERIENCE_LEVELS.find(
    (l) => l.value === roadmap.user.profile?.experienceLevel,
  )?.label;
  const experienceLevel =
    profileLevel ??
    CV_LEVEL_LABELS[cvReport.data.candidateProfile.experienceLevel] ??
    "Not specified";

  let job: RoadmapGenerationInput["job"] = null;
  if (roadmap.sourceType === "JOB_MATCH") {
    if (!roadmap.job || !roadmap.jobAnalysis) throw new RoadmapError("SOURCE_DELETED");
    const matchReport = jobMatchReportSchema.safeParse(roadmap.jobAnalysis.result);
    if (!matchReport.success) throw new RoadmapError("SOURCE_DELETED");
    job = {
      description: [roadmap.job.title, roadmap.job.description].filter(Boolean).join("\n"),
      requirements: matchReport.data.requirements.map((r) => ({
        term: r.term,
        kind: r.kind,
        importance: r.importance,
        match: r.match,
        evidenceFromJob: r.evidenceFromJob,
        evidenceFromCv: r.evidenceFromCv,
      })),
    };
  }

  return {
    target: {
      type: roadmap.sourceType === "JOB_MATCH" ? "job" : "career_goal",
      title: roadmap.goal,
      company: roadmap.job?.company ?? null,
    },
    sourceLabel:
      roadmap.sourceType === "JOB_MATCH" && roadmap.job
        ? `Based on your CV (${roadmap.cv.fileName}) and the ${jobMatchLabel(roadmap.job)} job match`
        : `Career-goal roadmap for ${roadmap.goal}, based on your CV (${roadmap.cv.fileName})`,
    cvText: roadmap.cv.extractedText,
    cvTruncated: roadmap.cv.textTruncated,
    verifiedCvSkills: cvReport.data.skills.filter((s) => s.verified).map((s) => s.name),
    experienceLevel,
    job,
    timeframeWeeks: roadmap.timeframeWeeks,
  };
}

export async function runRoadmapGeneration(roadmapId: string): Promise<void> {
  const claimed = await prisma.roadmap.updateMany({
    where: { id: roadmapId, status: "PENDING" },
    data: { status: "PROCESSING", stage: "ANALYZING", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    const outcome = await generateRoadmap(await buildInput(roadmapId), getAIProvider());
    await prisma.roadmap.update({ where: { id: roadmapId }, data: { stage: "FINALIZING" } });

    const locks = resolveLocks(
      outcome.tasks.map((t) => ({
        key: t.key,
        status: "AVAILABLE" as TaskStatus,
        dependsOn: t.dependsOn,
      })),
    );
    await prisma.$transaction([
      prisma.roadmapItem.createMany({
        data: outcome.tasks.map((t) => ({ ...t, roadmapId, status: locks.get(t.key)! })),
      }),
      prisma.roadmap.update({
        where: { id: roadmapId },
        data: {
          status: "COMPLETED",
          title: outcome.report.title,
          result: outcome.report,
          provider: outcome.provider,
          model: outcome.model,
          roadmapVersion: outcome.report.reportVersion,
          completedAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    const code =
      error instanceof RoadmapError
        ? error.code
        : error instanceof AIConfigurationError
          ? "AI_UNAVAILABLE"
          : "UNKNOWN";
    console.error(`[roadmap] generation ${roadmapId} failed: ${code}`);
    await prisma.roadmap
      .update({
        where: { id: roadmapId },
        data: { status: "FAILED", errorCode: code, completedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

export async function expireStaleRoadmaps(scope: { userId: string } | { roadmapId: string }) {
  await prisma.roadmap.updateMany({
    where: {
      status: { in: [...ACTIVE] },
      updatedAt: { lt: new Date(Date.now() - staleAfterMs()) },
      ...("userId" in scope ? { userId: scope.userId } : { id: scope.roadmapId }),
    },
    data: { status: "FAILED", errorCode: "ANALYSIS_INTERRUPTED", completedAt: new Date() },
  });
}

export async function deleteRoadmap(userId: string, roadmapId: string): Promise<boolean> {
  const deleted = await prisma.roadmap.deleteMany({ where: { id: roadmapId, userId } });
  return deleted.count > 0;
}

/**
 * Changes one task's status (no AI involved) and re-resolves which tasks are
 * locked. Returns the roadmap's new progress.
 */
export async function updateTaskStatus(userId: string, taskId: string, status: UserSettableStatus) {
  const task = await prisma.roadmapItem.findFirst({
    where: { id: taskId, roadmap: { userId } },
    select: { roadmapId: true, status: true, roadmap: { select: { status: true } } },
  });
  // Another user's task is indistinguishable from a missing one.
  if (!task) throw new RoadmapError("TASK_NOT_FOUND");
  if (task.roadmap.status !== "COMPLETED") throw new RoadmapError("ROADMAP_NOT_READY");

  const check = checkTransition(task.status, status);
  if (!check.ok && check.reason === "LOCKED") throw new RoadmapError("TASK_LOCKED");

  return withLock(`roadmap-tasks:${task.roadmapId}`, async () => {
    if (check.ok) {
      const now = new Date();
      await prisma.roadmapItem.update({
        where: { id: taskId },
        data: {
          status,
          startedAt: status === "AVAILABLE" ? null : status === "IN_PROGRESS" ? now : undefined,
          completedAt: status === "COMPLETED" ? now : null,
        },
      });
    }

    const items = await prisma.roadmapItem.findMany({
      where: { roadmapId: task.roadmapId },
      select: { id: true, key: true, status: true, dependsOn: true },
    });
    const resolved = resolveLocks(items);
    const changes = items.filter((i) => resolved.get(i.key) !== i.status);
    if (changes.length > 0) {
      await prisma.$transaction(
        changes.map((i) =>
          prisma.roadmapItem.update({
            where: { id: i.id },
            data: { status: resolved.get(i.key)! },
          }),
        ),
      );
    }
    return computeProgress(items.map((i) => ({ status: resolved.get(i.key)! })));
  });
}
