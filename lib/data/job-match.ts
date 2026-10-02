import "server-only";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jobMatchReportSchema, type JobMatchReport } from "@/lib/job-match/schema";
import { expireStaleJobAnalyses } from "@/lib/job-match/service";

/**
 * Read access to the signed-in user's job matches. Every query is scoped by
 * the session user's id. CV text is never selected here.
 */

const runSelect = {
  id: true,
  status: true,
  stage: true,
  matchScore: true,
  provider: true,
  errorCode: true,
  createdAt: true,
  cv: { select: { id: true, fileName: true } },
} as const;

/** CVs usable for a match: the user's own, with at least one completed analysis. */
export async function listMyAnalyzedCvs() {
  const user = await requireUser();
  const cvs = await prisma.cV.findMany({
    where: { userId: user.id, analyses: { some: { status: "COMPLETED" } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      analyses: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { score: true, completedAt: true, createdAt: true },
      },
    },
  });
  return cvs.map((cv) => ({
    id: cv.id,
    fileName: cv.fileName,
    uploadedAt: cv.createdAt,
    lastAnalyzedAt: cv.analyses[0]?.completedAt ?? cv.analyses[0]?.createdAt ?? null,
    score: cv.analyses[0]?.score ?? null,
  }));
}

export type AnalyzedCvOption = Awaited<ReturnType<typeof listMyAnalyzedCvs>>[number];

/** The user's job matches, newest first, each with its latest run. */
export async function listMyJobMatches() {
  const user = await requireUser();
  await expireStaleJobAnalyses({ userId: user.id });
  return prisma.job.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      company: true,
      createdAt: true,
      analyses: { orderBy: { createdAt: "desc" }, take: 1, select: runSelect },
      _count: { select: { analyses: true } },
    },
  });
}

export type MyJobMatchListItem = Awaited<ReturnType<typeof listMyJobMatches>>[number];

/** One job match with its runs, or null if it doesn't exist or isn't the user's. */
export async function getMyJobMatch(jobId: string) {
  const user = await requireUser();
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      sourceUrl: true,
      description: true,
      createdAt: true,
      analyses: { orderBy: { createdAt: "desc" }, select: runSelect },
    },
  });
  if (job) await expireStaleJobAnalyses({ jobId: job.id });
  return job;
}

export type MyJobMatch = NonNullable<Awaited<ReturnType<typeof getMyJobMatch>>>;

/** A completed report for one of the user's matches, validated on read. */
export async function getMyJobMatchReport(
  jobId: string,
  analysisId: string,
): Promise<{ report: JobMatchReport; provider: string } | null> {
  const user = await requireUser();
  const run = await prisma.jobAnalysis.findFirst({
    where: { id: analysisId, jobId, status: "COMPLETED", job: { userId: user.id } },
    select: { result: true, provider: true },
  });
  if (!run) return null;
  const parsed = jobMatchReportSchema.safeParse(run.result);
  return parsed.success ? { report: parsed.data, provider: run.provider } : null;
}

/** Lightweight status for progress polling. */
export async function getMyJobAnalysisStatus(analysisId: string) {
  const user = await requireUser();
  await expireStaleJobAnalyses({ userId: user.id });
  return prisma.jobAnalysis.findFirst({
    where: { id: analysisId, job: { userId: user.id } },
    select: { status: true, stage: true, errorCode: true },
  });
}
