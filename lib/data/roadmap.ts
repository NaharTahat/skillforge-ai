import "server-only";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { careerGoalLabel, EXPERIENCE_LEVELS } from "@/lib/profile/options";
import { computeProgress } from "@/lib/roadmap/progress";
import { roadmapReportSchema, type RoadmapReport } from "@/lib/roadmap/schema";
import { expireStaleRoadmaps } from "@/lib/roadmap/service";

/**
 * Read access to the signed-in user's roadmaps and roadmap sources. Every
 * query is scoped by the session user's id. CV text is never selected.
 */

/** What the user can build a roadmap from, plus the reason when they can't. */
export async function getRoadmapSources() {
  const user = await requireUser();
  const [cvCount, analyzedCvs, profile, jobs] = await Promise.all([
    prisma.cV.count({ where: { userId: user.id } }),
    prisma.cV.findMany({
      where: { userId: user.id, analyses: { some: { status: "COMPLETED" } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        analyses: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { score: true, createdAt: true },
        },
      },
    }),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { careerGoal: true, experienceLevel: true },
    }),
    prisma.job.findMany({
      where: {
        userId: user.id,
        analyses: { some: { status: "COMPLETED", cv: { isNot: null } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        company: true,
        analyses: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { matchScore: true, createdAt: true, cv: { select: { fileName: true } } },
        },
      },
    }),
  ]);

  return {
    hasCv: cvCount > 0,
    analyzedCvs: analyzedCvs.map((cv) => ({
      id: cv.id,
      fileName: cv.fileName,
      score: cv.analyses[0]?.score ?? null,
      analyzedAt: cv.analyses[0]?.createdAt ?? null,
    })),
    careerGoal: profile?.careerGoal ? careerGoalLabel(profile.careerGoal) : null,
    experienceLevel:
      EXPERIENCE_LEVELS.find((l) => l.value === profile?.experienceLevel)?.label ?? null,
    jobMatches: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      matchScore: job.analyses[0]?.matchScore ?? null,
      cvFileName: job.analyses[0]?.cv?.fileName ?? null,
      matchedAt: job.analyses[0]?.createdAt ?? null,
    })),
  };
}

export type RoadmapSources = Awaited<ReturnType<typeof getRoadmapSources>>;

export async function listMyRoadmaps() {
  const user = await requireUser();
  await expireStaleRoadmaps({ userId: user.id });
  const roadmaps = await prisma.roadmap.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      goal: true,
      sourceType: true,
      status: true,
      provider: true,
      errorCode: true,
      createdAt: true,
      regeneratedFromId: true,
      items: { select: { status: true } },
    },
  });
  return roadmaps.map(({ items, ...roadmap }) => ({
    ...roadmap,
    progress: computeProgress(items),
  }));
}

export type MyRoadmapListItem = Awaited<ReturnType<typeof listMyRoadmaps>>[number];

/** A roadmap with its tasks, or null if it doesn't exist or isn't the user's. */
export async function getMyRoadmap(roadmapId: string) {
  const user = await requireUser();
  await expireStaleRoadmaps({ roadmapId });
  const roadmap = await prisma.roadmap.findFirst({
    where: { id: roadmapId, userId: user.id },
    select: {
      id: true,
      title: true,
      goal: true,
      sourceType: true,
      status: true,
      stage: true,
      provider: true,
      errorCode: true,
      result: true,
      careerGoal: true,
      createdAt: true,
      cvId: true,
      jobId: true,
      regeneratedFromId: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          key: true,
          position: true,
          phaseOrder: true,
          title: true,
          description: true,
          skill: true,
          category: true,
          priority: true,
          estimatedHours: true,
          estimatedDays: true,
          prerequisites: true,
          dependsOn: true,
          practicalOutcome: true,
          verificationMethod: true,
          status: true,
        },
      },
    },
  });
  if (!roadmap) return null;

  const { result, ...rest } = roadmap;
  const parsed = result === null ? null : roadmapReportSchema.safeParse(result);
  const report: RoadmapReport | null = parsed?.success ? parsed.data : null;
  return {
    ...rest,
    report,
    reportUnreadable: parsed !== null && !parsed.success,
    careerGoalLabel: roadmap.careerGoal ? careerGoalLabel(roadmap.careerGoal) : null,
    progress: computeProgress(roadmap.items),
  };
}

export type MyRoadmap = NonNullable<Awaited<ReturnType<typeof getMyRoadmap>>>;
export type MyRoadmapTask = MyRoadmap["items"][number];

export async function getMyRoadmapStatus(roadmapId: string) {
  const user = await requireUser();
  await expireStaleRoadmaps({ userId: user.id });
  return prisma.roadmap.findFirst({
    where: { id: roadmapId, userId: user.id },
    select: { status: true, stage: true },
  });
}
