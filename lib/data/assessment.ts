import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { cvAnalysisReportSchema } from "@/lib/cv/analysis-schema";
import { prisma } from "@/lib/db/prisma";
import { MAX_SKILLS } from "@/lib/assessment/constants";
import {
  categoryScoreSchema,
  skillScoreSchema,
  storedInsightsSchema,
} from "@/lib/assessment/schema";
import { expireStaleAssessments } from "@/lib/assessment/service";
import {
  DEFAULT_ROLE_SKILLS,
  ROLE_SKILLS,
  skillsInText,
  SUPPORTED_SKILLS,
  supportedSkill,
} from "@/lib/assessment/skills";
import { assessmentProgress, isFinished, isPastDeadline } from "@/lib/assessment/state";
import { jobMatchReportSchema } from "@/lib/job-match/schema";
import { careerGoalLabel } from "@/lib/profile/options";

/**
 * Read access to the signed-in user's assessments. Every query is scoped by the
 * session user's id. Answer keys, expected points and explanations are only
 * returned once an assessment is finished.
 */

function verifiedSupportedSkills(result: unknown): string[] {
  const parsed = cvAnalysisReportSchema.safeParse(result);
  if (!parsed.success) return [];
  return [
    ...new Set(
      parsed.data.skills
        .filter((s) => s.verified)
        .map((s) => supportedSkill(s.name))
        .filter((s): s is string => !!s),
    ),
  ];
}

/** What the user can build an assessment from, with skill previews from real data. */
export async function getAssessmentSources() {
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
          select: { score: true, result: true },
        },
      },
    }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { careerGoal: true } }),
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
          select: { matchScore: true, result: true, cv: { select: { fileName: true } } },
        },
      },
    }),
  ]);
  const goal = profile?.careerGoal ? careerGoalLabel(profile.careerGoal) : null;
  return {
    hasCv: cvCount > 0,
    careerGoal: goal,
    careerGoalSkills: goal ? [...(ROLE_SKILLS[goal] ?? DEFAULT_ROLE_SKILLS)] : [],
    analyzedCvs: analyzedCvs.map((cv) => ({
      id: cv.id,
      fileName: cv.fileName,
      score: cv.analyses[0]?.score ?? null,
      verifiedSkills: verifiedSupportedSkills(cv.analyses[0]?.result),
    })),
    jobMatches: jobs
      .filter((j) => j.analyses[0]?.cv)
      .map((j) => {
        const run = j.analyses[0]!;
        const report = jobMatchReportSchema.safeParse(run.result);
        const skills: string[] = [];
        for (const r of report.success ? report.data.requirements : []) {
          for (const s of skillsInText(`${r.term} ${r.requirement}`))
            if (!skills.includes(s)) skills.push(s);
        }
        return {
          id: j.id,
          title: j.title,
          company: j.company,
          matchScore: run.matchScore,
          cvFileName: run.cv!.fileName,
          skills: skills.slice(0, MAX_SKILLS),
        };
      }),
    supportedSkills: SUPPORTED_SKILLS.map((s) => ({ name: s.name, group: s.group })),
  };
}

export type AssessmentSources = Awaited<ReturnType<typeof getAssessmentSources>>;

export async function listMyAssessments(take = 50) {
  const user = await requireUser();
  await expireStaleAssessments({ userId: user.id });
  return prisma.assessment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      sourceType: true,
      skills: true,
      difficulty: true,
      questionCount: true,
      status: true,
      provider: true,
      createdAt: true,
      practiceOfId: true,
      result: { select: { percentage: true, level: true } },
    },
  });
}

export type MyAssessmentListItem = Awaited<ReturnType<typeof listMyAssessments>>[number];

const optionsSchema = z
  .array(z.object({ id: z.string(), label: z.string() }))
  .nullable()
  .catch(null);

/** The assessment for taking it: no answer keys, expected points or explanations. */
export async function getMyAssessment(assessmentId: string) {
  const user = await requireUser();
  await expireStaleAssessments({ assessmentId });
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, userId: user.id },
    select: {
      id: true,
      title: true,
      sourceType: true,
      skills: true,
      type: true,
      difficulty: true,
      focus: true,
      questionCount: true,
      timeLimitMinutes: true,
      status: true,
      stage: true,
      provider: true,
      errorCode: true,
      startedAt: true,
      expiresAt: true,
      createdAt: true,
      practiceOfId: true,
      job: { select: { title: true, company: true } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          type: true,
          skill: true,
          difficulty: true,
          scenario: true,
          prompt: true,
          options: true,
          source: true,
          sourceReason: true,
          status: true,
          answer: { select: { response: true } },
        },
      },
    },
  });
  if (!a) return null;
  return {
    ...a,
    questions: a.questions.map((q) => ({ ...q, options: optionsSchema.parse(q.options) })),
    progress: assessmentProgress(a.questions),
    timeUp: a.status === "IN_PROGRESS" && isPastDeadline(a.expiresAt),
    serverNow: new Date(),
  };
}

export type MyAssessment = NonNullable<Awaited<ReturnType<typeof getMyAssessment>>>;
export type MyAssessmentQuestion = MyAssessment["questions"][number];

/** Full results (answer keys included), only once the assessment is finished. */
export async function getMyAssessmentResult(assessmentId: string) {
  const user = await requireUser();
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, userId: user.id },
    select: {
      id: true,
      title: true,
      sourceType: true,
      skills: true,
      type: true,
      difficulty: true,
      focus: true,
      questionCount: true,
      status: true,
      provider: true,
      completedAt: true,
      jobId: true,
      job: { select: { title: true, company: true } },
      jobAnalysis: { select: { result: true } },
      result: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          type: true,
          skill: true,
          difficulty: true,
          scenario: true,
          prompt: true,
          options: true,
          correctAnswer: true,
          expectedPoints: true,
          explanation: true,
          source: true,
          sourceReason: true,
          status: true,
          answer: {
            select: {
              response: true,
              isCorrect: true,
              score: true,
              feedback: true,
              accuracy: true,
              relevance: true,
              completeness: true,
              clarity: true,
              technicalDepth: true,
            },
          },
        },
      },
    },
  });
  if (!a) return null;
  if (!isFinished(a.status) || !a.result) return { finished: false as const, id: a.id };

  const r = a.result;
  const parse = <T>(schema: z.ZodType<T>, value: unknown, fallback: T) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : fallback;
  };
  const insights = parse(
    storedInsightsSchema,
    {
      strengths: r.strengths,
      improvementAreas: r.improvementAreas,
      recommendations: r.recommendations,
      reviewTopics: r.reviewTopics,
    },
    { strengths: [], improvementAreas: [], recommendations: [], reviewTopics: [] },
  );

  // Job Match alignment: which job requirements each tested skill came from.
  let jobAlignment:
    { skill: string; requirements: { term: string; match: string; kind: string }[] }[] | null =
    null;
  if (a.sourceType === "JOB_MATCH" && a.jobAnalysis) {
    const report = jobMatchReportSchema.safeParse(a.jobAnalysis.result);
    if (report.success) {
      jobAlignment = a.skills.map((skill) => ({
        skill,
        requirements: report.data.requirements
          .filter((req) => skillsInText(`${req.term} ${req.requirement}`).includes(skill))
          .map((req) => ({ term: req.term, match: req.match, kind: req.kind })),
      }));
    }
  }

  // A separate measurement — never combined with the assessment score.
  const interview = await prisma.interview.findFirst({
    where: { userId: user.id, status: "COMPLETED", ...(a.jobId ? { jobId: a.jobId } : {}) },
    orderBy: { completedAt: "desc" },
    select: { id: true, overallScore: true, target: true, completedAt: true },
  });

  return {
    finished: true as const,
    assessment: { ...a, result: undefined, jobAnalysis: undefined },
    questions: a.questions.map((q) => ({ ...q, options: optionsSchema.parse(q.options) })),
    score: {
      rawScore: r.rawScore,
      maxScore: r.maxScore,
      percentage: r.percentage,
      level: r.level,
      timeExpired: r.timeExpired,
      insightsSource: r.insightsSource,
    },
    skills: parse(z.array(skillScoreSchema), r.skillBreakdown, []),
    categories: parse(z.array(categoryScoreSchema), r.categoryBreakdown, []),
    insights,
    jobAlignment,
    interview: interview?.overallScore != null ? interview : null,
  };
}

export type MyAssessmentResult = Extract<
  NonNullable<Awaited<ReturnType<typeof getMyAssessmentResult>>>,
  { finished: true }
>;

export async function getMyAssessmentStatus(assessmentId: string) {
  const user = await requireUser();
  await expireStaleAssessments({ userId: user.id });
  return prisma.assessment.findFirst({
    where: { id: assessmentId, userId: user.id },
    select: { status: true, stage: true },
  });
}

/** Real dashboard numbers for the signed-in user. */
export async function getAssessmentDashboardSummary() {
  const user = await requireUser();
  const results = await prisma.assessmentResult.findMany({
    where: { assessment: { userId: user.id } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      percentage: true,
      level: true,
      skillBreakdown: true,
      assessment: { select: { id: true, title: true } },
    },
  });
  if (results.length === 0) return null;
  // Latest result per skill; the weakest is the lowest of those.
  const latestBySkill = new Map<string, number>();
  for (const r of results) {
    for (const s of z.array(skillScoreSchema).catch([]).parse(r.skillBreakdown)) {
      if (!latestBySkill.has(s.skill)) latestBySkill.set(s.skill, s.percentage);
    }
  }
  const weakest = [...latestBySkill.entries()].sort((a, b) => a[1] - b[1])[0] ?? null;
  return {
    latest: {
      percentage: results[0]!.percentage,
      level: results[0]!.level,
      id: results[0]!.assessment.id,
      title: results[0]!.assessment.title,
    },
    completed: results.length,
    skillsTested: latestBySkill.size,
    weakest: weakest ? { skill: weakest[0], percentage: weakest[1] } : null,
  };
}
