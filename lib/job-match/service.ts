import "server-only";
import { after } from "next/server";
import { analyzeJobMatch } from "@/lib/ai/job-matcher";
import { AIConfigurationError, getAIProvider } from "@/lib/ai/provider";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { createKeyedLock } from "@/lib/security/keyed-lock";
import { JobMatchError } from "./errors";
import type { JobMatchData } from "./validation";

/**
 * Job Match pipeline. Every entry point takes the owner's id from the caller's
 * session and scopes every query by it. Nothing here logs CV text, job
 * descriptions, prompts or model output — only ids and error codes.
 */

const ACTIVE = ["PENDING", "PROCESSING"] as const;
// Per-instance: serializes creates per user and re-runs per job, so concurrent
// duplicate requests see each other's writes (see README on scaling).
const withLock = createKeyedLock();

function staleAfterMs() {
  return getEnv().AI_TIMEOUT_MS * 2 + 60_000;
}

/** The user's CV, provided it has at least one completed analysis. */
async function requireAnalyzedCv(userId: string, cvId: string) {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: {
      id: true,
      analyses: { where: { status: "COMPLETED" }, take: 1, select: { id: true } },
    },
  });
  // Another user's CV is indistinguishable from a missing one.
  if (!cv) throw new JobMatchError("CV_NOT_FOUND");
  if (cv.analyses.length === 0) throw new JobMatchError("CV_NOT_ANALYZED");
  return cv;
}

export async function createJobMatch(
  userId: string,
  data: JobMatchData,
): Promise<{ jobId: string; analysisId: string; reused: boolean }> {
  return withLock(`create:${userId}`, async () => {
    const cv = await requireAnalyzedCv(userId, data.cvId);

    // The same submission already running (double submit, second tab): reuse it.
    const running = await prisma.jobAnalysis.findFirst({
      where: {
        cvId: cv.id,
        status: { in: [...ACTIVE] },
        job: { userId, description: data.jobDescription },
      },
      select: { id: true, jobId: true },
    });
    if (running) return { jobId: running.jobId, analysisId: running.id, reused: true };

    const job = await prisma.job.create({
      data: {
        userId,
        title: data.jobTitle,
        company: data.company,
        location: data.location,
        sourceUrl: data.jobUrl,
        description: data.jobDescription,
        analyses: { create: { cvId: cv.id, provider: getEnv().AI_PROVIDER } },
      },
      select: { id: true, analyses: { select: { id: true } } },
    });
    const analysisId = job.analyses[0]!.id;
    scheduleJobMatch(analysisId);
    return { jobId: job.id, analysisId, reused: false };
  });
}

/**
 * Re-runs a match with its stored job description and the same CV (with that
 * CV's current text). Returns the running analysis instead of starting a second.
 */
export async function requestJobReanalysis(
  userId: string,
  jobId: string,
): Promise<{ analysisId: string; reused: boolean }> {
  return withLock(`job:${jobId}`, async () => {
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      select: {
        id: true,
        analyses: { orderBy: { createdAt: "desc" }, take: 1, select: { cvId: true } },
      },
    });
    if (!job) throw new JobMatchError("MATCH_NOT_FOUND");

    await expireStaleJobAnalyses({ jobId });
    const active = await prisma.jobAnalysis.findFirst({
      where: { jobId, status: { in: [...ACTIVE] } },
      select: { id: true },
    });
    if (active) return { analysisId: active.id, reused: true };

    const cvId = job.analyses[0]?.cvId;
    if (!cvId) throw new JobMatchError("CV_DELETED");
    await requireAnalyzedCv(userId, cvId);

    const analysis = await prisma.jobAnalysis.create({
      data: { jobId, cvId, provider: getEnv().AI_PROVIDER },
      select: { id: true },
    });
    scheduleJobMatch(analysis.id);
    return { analysisId: analysis.id, reused: false };
  });
}

function scheduleJobMatch(analysisId: string) {
  after(() => runJobMatch(analysisId));
}

export async function runJobMatch(analysisId: string): Promise<void> {
  // Claim atomically: only a PENDING analysis can start.
  const claimed = await prisma.jobAnalysis.updateMany({
    where: { id: analysisId, status: "PENDING" },
    data: { status: "PROCESSING", stage: "ANALYZING", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    const analysis = await prisma.jobAnalysis.findUniqueOrThrow({
      where: { id: analysisId },
      select: {
        job: { select: { title: true, company: true, location: true, description: true } },
        cv: { select: { extractedText: true, textTruncated: true } },
      },
    });
    if (!analysis.cv) throw new JobMatchError("CV_DELETED");

    const outcome = await analyzeJobMatch(
      {
        cvText: analysis.cv.extractedText,
        cvTruncated: analysis.cv.textTruncated,
        job: analysis.job,
      },
      getAIProvider(),
    );

    await prisma.jobAnalysis.update({ where: { id: analysisId }, data: { stage: "FINALIZING" } });
    await prisma.jobAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        matchScore: outcome.report.score.overall,
        result: outcome.report,
        provider: outcome.provider,
        model: outcome.model,
        scoringVersion: outcome.report.score.version,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const code =
      error instanceof JobMatchError
        ? error.code
        : error instanceof AIConfigurationError
          ? "AI_UNAVAILABLE"
          : "UNKNOWN";
    console.error(`[job-match] analysis ${analysisId} failed: ${code}`);
    await prisma.jobAnalysis
      .update({
        where: { id: analysisId },
        data: { status: "FAILED", errorCode: code, completedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

/** Marks runs that can no longer finish (server restarted mid-run) as failed. */
export async function expireStaleJobAnalyses(scope: { jobId: string } | { userId: string }) {
  await prisma.jobAnalysis.updateMany({
    where: {
      status: { in: [...ACTIVE] },
      updatedAt: { lt: new Date(Date.now() - staleAfterMs()) },
      ...("jobId" in scope ? { jobId: scope.jobId } : { job: { userId: scope.userId } }),
    },
    data: { status: "FAILED", errorCode: "ANALYSIS_INTERRUPTED", completedAt: new Date() },
  });
}

/** Deletes the user's job match and all of its runs. The CV is untouched. */
export async function deleteJobMatch(userId: string, jobId: string): Promise<boolean> {
  const deleted = await prisma.job.deleteMany({ where: { id: jobId, userId } });
  return deleted.count > 0;
}
