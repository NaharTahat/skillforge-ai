import "server-only";
import { requireUser } from "@/lib/auth/session";
import { cvAnalysisReportSchema } from "@/lib/cv/analysis-schema";
import { prisma } from "@/lib/db/prisma";
import { defaultDifficulty, recommendedFocus } from "@/lib/interview/defaults";
import { interviewProgress } from "@/lib/interview/progress";
import { interviewReportSchema, type InterviewReport } from "@/lib/interview/schema";
import { expireStaleInterviews } from "@/lib/interview/service";
import { jobMatchReportSchema } from "@/lib/job-match/schema";
import { careerGoalLabel, EXPERIENCE_LEVELS } from "@/lib/profile/options";

/**
 * Read access to the signed-in user's interviews and interview sources. Every
 * query is scoped by the session user's id. CV text and job descriptions are
 * never selected here.
 */

function cvLevel(result: unknown): string | null {
  const parsed = cvAnalysisReportSchema.safeParse(result);
  return parsed.success ? parsed.data.candidateProfile.experienceLevel : null;
}

/** What the user can build an interview from, with defaults derived from real data. */
export async function getInterviewSources() {
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
          select: { score: true, createdAt: true, result: true },
        },
      },
    }),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { careerGoal: true, experienceLevel: true },
    }),
    prisma.job.findMany({
      where: { userId: user.id, analyses: { some: { status: "COMPLETED", cv: { isNot: null } } } },
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
          select: {
            matchScore: true,
            createdAt: true,
            result: true,
            cv: {
              select: {
                fileName: true,
                analyses: {
                  where: { status: "COMPLETED" },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { result: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const profileLevel = profile?.experienceLevel ?? null;
  return {
    hasCv: cvCount > 0,
    careerGoal: profile?.careerGoal ? careerGoalLabel(profile.careerGoal) : null,
    experienceLevel: EXPERIENCE_LEVELS.find((l) => l.value === profileLevel)?.label ?? null,
    analyzedCvs: analyzedCvs.map((cv) => ({
      id: cv.id,
      fileName: cv.fileName,
      score: cv.analyses[0]?.score ?? null,
      analyzedAt: cv.analyses[0]?.createdAt ?? null,
      defaultDifficulty: defaultDifficulty(profileLevel, cvLevel(cv.analyses[0]?.result)),
    })),
    jobMatches: jobs
      .filter((job) => job.analyses[0]?.cv)
      .map((job) => {
        const run = job.analyses[0]!;
        const report = jobMatchReportSchema.safeParse(run.result);
        const requirements = report.success ? report.data.requirements : [];
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          matchScore: run.matchScore,
          cvFileName: run.cv!.fileName,
          matchedAt: run.createdAt,
          recommendedFocus: recommendedFocus(requirements),
          gapCount: requirements.filter((r) => r.match !== "PRESENT").length,
          defaultDifficulty: defaultDifficulty(profileLevel, cvLevel(run.cv!.analyses[0]?.result)),
        };
      }),
  };
}

export type InterviewSources = Awaited<ReturnType<typeof getInterviewSources>>;

export async function listMyInterviews() {
  const user = await requireUser();
  await expireStaleInterviews({ userId: user.id });
  return prisma.interview.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      target: true,
      sourceType: true,
      type: true,
      difficulty: true,
      status: true,
      overallScore: true,
      provider: true,
      createdAt: true,
      practiceOfId: true,
      job: { select: { company: true } },
    },
  });
}

export type MyInterviewListItem = Awaited<ReturnType<typeof listMyInterviews>>[number];

/** An interview with its questions and the owner's answers, or null if missing / not the user's. */
export async function getMyInterview(interviewId: string) {
  const user = await requireUser();
  await expireStaleInterviews({ interviewId });
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, userId: user.id },
    select: {
      id: true,
      target: true,
      sourceType: true,
      type: true,
      difficulty: true,
      focus: true,
      questionCount: true,
      status: true,
      stage: true,
      provider: true,
      introduction: true,
      errorCode: true,
      result: true,
      overallScore: true,
      createdAt: true,
      completedAt: true,
      practiceOfId: true,
      cv: { select: { fileName: true } },
      job: { select: { company: true } },
      questions: {
        orderBy: [{ position: "asc" }, { followUpIndex: "asc" }],
        select: {
          id: true,
          position: true,
          followUpIndex: true,
          kind: true,
          prompt: true,
          skill: true,
          source: true,
          sourceReason: true,
          sourceEvidence: true,
          status: true,
          answer: {
            select: {
              content: true,
              status: true,
              verdict: true,
              technicalAccuracy: true,
              relevance: true,
              completeness: true,
              clarity: true,
              communication: true,
              evidence: true,
              score: true,
              feedback: true,
              accuracyNote: true,
              strengths: true,
              missingPoints: true,
              improvement: true,
              errorCode: true,
            },
          },
        },
      },
    },
  });
  if (!interview) return null;

  const { result, ...rest } = interview;
  const parsed = result === null ? null : interviewReportSchema.safeParse(result);
  const report: InterviewReport | null = parsed?.success ? parsed.data : null;
  return {
    ...rest,
    report,
    reportUnreadable: parsed !== null && !parsed.success,
    progress: interviewProgress(interview.questions, interview.questionCount),
  };
}

export type MyInterview = NonNullable<Awaited<ReturnType<typeof getMyInterview>>>;
export type MyInterviewQuestion = MyInterview["questions"][number];

export async function getMyInterviewStatus(interviewId: string) {
  const user = await requireUser();
  await expireStaleInterviews({ userId: user.id });
  return prisma.interview.findFirst({
    where: { id: interviewId, userId: user.id },
    select: { status: true, stage: true },
  });
}
