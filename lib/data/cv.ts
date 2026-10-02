import "server-only";
import { requireUser } from "@/lib/auth/session";
import { cvAnalysisReportSchema, type CvAnalysisReport } from "@/lib/cv/analysis-schema";
import { expireStaleAnalyses } from "@/lib/cv/service";
import { prisma } from "@/lib/db/prisma";

/**
 * Read access to the signed-in user's CVs. Every query is scoped by the
 * session user's id. Extracted CV text is never selected here — it stays on
 * the server and never reaches the browser.
 */

const analysisSummarySelect = {
  id: true,
  status: true,
  stage: true,
  score: true,
  provider: true,
  errorCode: true,
  createdAt: true,
  completedAt: true,
} as const;

export async function listMyCvs() {
  const user = await requireUser();
  await expireStaleAnalyses({ userId: user.id });
  return prisma.cV.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      pageCount: true,
      createdAt: true,
      analyses: { orderBy: { createdAt: "desc" }, take: 1, select: analysisSummarySelect },
      _count: { select: { analyses: true } },
    },
  });
}

export type MyCvListItem = Awaited<ReturnType<typeof listMyCvs>>[number];

export async function listMyRecentAnalyses(limit = 20) {
  const user = await requireUser();
  return prisma.cvAnalysis.findMany({
    where: { cv: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { ...analysisSummarySelect, cv: { select: { id: true, fileName: true } } },
  });
}

export type MyAnalysisHistoryItem = Awaited<ReturnType<typeof listMyRecentAnalyses>>[number];

/** The CV with its analysis history, or null if it doesn't exist or isn't the user's. */
export async function getMyCv(cvId: string) {
  const user = await requireUser();
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId: user.id },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      pageCount: true,
      textTruncated: true,
      createdAt: true,
      analyses: { orderBy: { createdAt: "desc" }, select: analysisSummarySelect },
    },
  });
  if (cv) await expireStaleAnalyses({ cvId: cv.id });
  return cv;
}

export type MyCv = NonNullable<Awaited<ReturnType<typeof getMyCv>>>;

/** A completed analysis report of one of the user's CVs, validated on read. */
export async function getMyAnalysisReport(
  cvId: string,
  analysisId: string,
): Promise<{ report: CvAnalysisReport; provider: string; model: string | null } | null> {
  const user = await requireUser();
  const analysis = await prisma.cvAnalysis.findFirst({
    where: { id: analysisId, cvId, status: "COMPLETED", cv: { userId: user.id } },
    select: { result: true, provider: true, model: true },
  });
  if (!analysis) return null;

  // Stored JSON is validated like any external input before rendering.
  const parsed = cvAnalysisReportSchema.safeParse(analysis.result);
  if (!parsed.success) return null;
  return { report: parsed.data, provider: analysis.provider, model: analysis.model };
}

/** Lightweight status for progress polling. */
export async function getMyAnalysisStatus(analysisId: string) {
  const user = await requireUser();
  await expireStaleAnalyses({ userId: user.id });
  return prisma.cvAnalysis.findFirst({
    where: { id: analysisId, cv: { userId: user.id } },
    select: { status: true, stage: true, errorCode: true },
  });
}
