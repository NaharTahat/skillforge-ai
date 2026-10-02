import "server-only";
import { after } from "next/server";
import {
  analyzeResults,
  evaluateOpenAnswer,
  generateAssessmentQuestions,
} from "@/lib/ai/assessment";
import { AIConfigurationError, getAIProvider } from "@/lib/ai/provider";
import { cvAnalysisReportSchema } from "@/lib/cv/analysis-schema";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { jobMatchReportSchema } from "@/lib/job-match/schema";
import { careerGoalLabel, EXPERIENCE_LEVELS } from "@/lib/profile/options";
import { roadmapReportSchema } from "@/lib/roadmap/schema";
import { skillKey } from "@/lib/roadmap/prioritization";
import { createKeyedLock } from "@/lib/security/keyed-lock";
import { isObjective, MAX_SKILLS, type QuestionLevel, type QuestionType } from "./constants";
import { AssessmentError, type AssessmentErrorCode } from "./errors";
import {
  mergeRecommendations,
  reviewTopicsFrom,
  roadmapRecommendations,
  ruleInsights,
} from "./insights";
import { buildPlan, type Evidence, type SkillContext } from "./plan";
import { ASSESSMENT_VERSION } from "./schema";
import { computeScores, isCorrectObjective } from "./scoring";
import { DEFAULT_ROLE_SKILLS, ROLE_SKILLS, skillsInText } from "./skills";
import { answerBlocker, deadlineFrom, isFinished, isPastDeadline } from "./state";
import type { AssessmentConfig, CreateAssessmentData } from "./validation";

/**
 * AI Assessment pipeline. Every entry point takes the owner's id from the
 * session and scopes every query by it. Logs carry ids and error codes only —
 * never answers, prompts, CV text or AI output.
 */

const GENERATING = ["DRAFT", "GENERATING"] as const;
/** Identical start requests this close together are one request (double-click, two tabs). */
export const DUPLICATE_WINDOW_MS = 10_000;
const EVALUATION_CONCURRENCY = 4;
const withLock = createKeyedLock();

const CV_LEVEL_LABELS: Record<string, string> = {
  STUDENT: "Student",
  ENTRY: "Entry level",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  LEAD: "Lead",
};

const staleAfterMs = () => getEnv().AI_TIMEOUT_MS * 3 + 60_000;

function errorCodeOf(error: unknown): AssessmentErrorCode {
  if (error instanceof AssessmentError) return error.code;
  if (error instanceof AIConfigurationError) return "AI_UNAVAILABLE";
  return "UNKNOWN";
}

/* ─── Sources → skills ──────────────────────────────────────────────────────── */

async function requireAnalyzedCv(userId: string, cvId: string) {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: {
      id: true,
      analyses: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, result: true },
      },
    },
  });
  if (!cv) throw new AssessmentError("CV_NOT_FOUND");
  const analysis = cv.analyses[0];
  if (!analysis) throw new AssessmentError("CV_NOT_ANALYZED");
  const report = cvAnalysisReportSchema.safeParse(analysis.result);
  return {
    cvId: cv.id,
    cvAnalysisId: analysis.id,
    /** Skill name → evidence from the CV analysis. */
    cvEvidence: new Map<string, Evidence>(
      report.success
        ? report.data.skills.map((s) => [skillKey(s.name), s.verified ? "demonstrated" : "partial"])
        : [],
    ),
  };
}

async function latestRoadmap(userId: string, prefer: { jobId?: string; careerGoal?: string }) {
  const select = { id: true, result: true } as const;
  const preferred =
    prefer.jobId || prefer.careerGoal
      ? await prisma.roadmap.findFirst({
          where: {
            userId,
            status: "COMPLETED",
            ...(prefer.jobId
              ? { jobId: prefer.jobId }
              : { sourceType: "CAREER_GOAL", careerGoal: prefer.careerGoal as never }),
          },
          orderBy: { createdAt: "desc" },
          select,
        })
      : null;
  return (
    preferred ??
    (await prisma.roadmap.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select,
    }))
  );
}

type Resolved = {
  title: string;
  skills: SkillContext[];
  data: {
    userId: string;
    sourceType: CreateAssessmentData["source"];
    title: string;
    skills: string[];
    cvId: string;
    cvAnalysisId: string;
    jobId?: string;
    jobAnalysisId?: string;
    careerGoal?: NonNullable<Awaited<ReturnType<typeof prisma.profile.findUnique>>>["careerGoal"];
    roadmapId: string | null;
  } & AssessmentConfig;
  target: { title: string; company: string | null };
};

const evidenceRank: Record<Evidence, number> = { none: 0, partial: 1, demonstrated: 2 };

/** Resolves sources and the supported skills to test, all ownership-checked. */
async function resolveSources(userId: string, input: CreateAssessmentData): Promise<Resolved> {
  const config: AssessmentConfig = {
    type: input.type,
    difficulty: input.difficulty,
    questionCount: input.questionCount,
    timeLimitMinutes: input.timeLimitMinutes,
    focus: input.focus,
  };
  const contexts: SkillContext[] = [];
  const add = (ctx: SkillContext) => {
    const existing = contexts.find((c) => c.skill === ctx.skill);
    if (!existing) {
      if (contexts.length < MAX_SKILLS) contexts.push(ctx);
    } else if (evidenceRank[ctx.evidence] > evidenceRank[existing.evidence]) {
      existing.evidence = ctx.evidence;
    }
  };

  if (input.source === "JOB_MATCH") {
    const job = await prisma.job.findFirst({
      where: { id: input.jobId, userId },
      select: {
        id: true,
        title: true,
        company: true,
        analyses: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, cvId: true, result: true },
        },
      },
    });
    if (!job) throw new AssessmentError("JOB_MATCH_NOT_FOUND");
    const run = job.analyses[0];
    if (!run) throw new AssessmentError("JOB_MATCH_NOT_READY");
    if (!run.cvId) throw new AssessmentError("SOURCE_DELETED");
    const cv = await requireAnalyzedCv(userId, run.cvId);
    const match = jobMatchReportSchema.safeParse(run.result);
    if (!match.success) throw new AssessmentError("SOURCE_DELETED");

    const importance = { CRITICAL: 0, IMPORTANT: 1, NICE_TO_HAVE: 2 } as const;
    const requirements = [...match.data.requirements].sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === "REQUIRED" ? -1 : 1) ||
        importance[a.importance] - importance[b.importance],
    );
    for (const r of requirements) {
      for (const skill of skillsInText(`${r.term} ${r.requirement}`)) {
        add({
          skill,
          source: "JOB_MATCH",
          reason: `The job lists ${r.term} (${r.kind === "REQUIRED" ? "required" : "preferred"}).`,
          evidence:
            r.match === "PRESENT" ? "demonstrated" : r.match === "PARTIAL" ? "partial" : "none",
        });
      }
    }
    if (contexts.length === 0) throw new AssessmentError("NO_SUPPORTED_SKILLS");
    const target = job.title ?? "Untitled job";
    const roadmap = await latestRoadmap(userId, { jobId: job.id });
    return {
      title: `Assessment for ${target}`,
      skills: contexts,
      target: { title: target, company: job.company },
      data: {
        userId,
        sourceType: "JOB_MATCH",
        title: `Assessment for ${target}`,
        skills: contexts.map((c) => c.skill),
        cvId: cv.cvId,
        cvAnalysisId: cv.cvAnalysisId,
        jobId: job.id,
        jobAnalysisId: run.id,
        roadmapId: roadmap?.id ?? null,
        ...config,
      },
    };
  }

  const cv = await requireAnalyzedCv(userId, input.cvId);
  const cvEvidence = (skill: string): Evidence => cv.cvEvidence.get(skillKey(skill)) ?? "none";

  if (input.source === "CAREER_GOAL") {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { careerGoal: true },
    });
    const goal = profile?.careerGoal;
    if (!goal) throw new AssessmentError("NO_CAREER_GOAL");
    const label = careerGoalLabel(goal) ?? "your career goal";
    for (const skill of ROLE_SKILLS[label] ?? DEFAULT_ROLE_SKILLS) {
      add({
        skill,
        source: "CAREER_GOAL",
        reason: `${skill} is a core skill for ${label}.`,
        evidence: cvEvidence(skill),
      });
    }
    const roadmap = await latestRoadmap(userId, { careerGoal: goal });
    const report = roadmap ? roadmapReportSchema.safeParse(roadmap.result) : null;
    if (report?.success) {
      for (const gap of report.data.skillGaps.filter((g) => g.status !== "STRONG")) {
        for (const skill of skillsInText(gap.skill)) {
          add({
            skill,
            source: "ROADMAP",
            reason: `Your career roadmap lists ${gap.skill} as a skill to develop.`,
            evidence: cvEvidence(skill),
          });
        }
      }
    }
    return {
      title: `${label} assessment`,
      skills: contexts,
      target: { title: label, company: null },
      data: {
        userId,
        sourceType: "CAREER_GOAL",
        title: `${label} assessment`,
        skills: contexts.map((c) => c.skill),
        cvId: cv.cvId,
        cvAnalysisId: cv.cvAnalysisId,
        careerGoal: goal,
        roadmapId: roadmap?.id ?? null,
        ...config,
      },
    };
  }

  for (const skill of input.skills) {
    const evidence = cvEvidence(skill);
    add(
      evidence === "demonstrated"
        ? {
            skill,
            source: "CV_ANALYSIS",
            reason: `You selected ${skill}; it is verified in your CV analysis.`,
            evidence,
          }
        : { skill, source: "SKILL_SELECTION", reason: `You selected ${skill}.`, evidence },
    );
  }
  const names = contexts.map((c) => c.skill);
  const title =
    input.source === "SKILL"
      ? `${names[0]} assessment`
      : `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""} assessment`;
  const roadmap = await latestRoadmap(userId, {});
  return {
    title,
    skills: contexts,
    target: { title, company: null },
    data: {
      userId,
      sourceType: input.source,
      title,
      skills: names,
      cvId: cv.cvId,
      cvAnalysisId: cv.cvAnalysisId,
      roadmapId: roadmap?.id ?? null,
      ...config,
    },
  };
}

/* ─── Create / practice again ───────────────────────────────────────────────── */

async function startOrReuse(resolved: Resolved, practiceOfId: string | null) {
  const d = resolved.data;
  await expireStaleAssessments({ userId: d.userId });
  // A double-click (or two tabs) with the same source and settings joins the running generation,
  // or the assessment it just produced — however fast generation was. Failed ones are never reused.
  const existing = await prisma.assessment.findFirst({
    where: {
      userId: d.userId,
      OR: [
        { status: { in: [...GENERATING] } },
        {
          status: { not: "FAILED" },
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
      ],
      practiceOfId,
      sourceType: d.sourceType,
      jobId: d.jobId ?? null,
      cvId: d.cvId,
      skills: { equals: d.skills },
      type: d.type,
      difficulty: d.difficulty,
      focus: d.focus,
      questionCount: d.questionCount,
      timeLimitMinutes: d.timeLimitMinutes,
    },
    select: { id: true },
  });
  if (existing) return { assessmentId: existing.id, reused: true };

  const assessment = await prisma.assessment.create({
    data: { ...d, practiceOfId, provider: getEnv().AI_PROVIDER },
    select: { id: true },
  });
  after(() => runAssessmentGeneration(assessment.id, resolved.skills, resolved.target));
  return { assessmentId: assessment.id, reused: false };
}

export async function createAssessment(userId: string, input: CreateAssessmentData) {
  return withLock(`assessment:${userId}`, async () =>
    startOrReuse(await resolveSources(userId, input), null),
  );
}

/** Creates a new assessment with the same sources and settings. The old one is kept. */
export async function practiceAgain(userId: string, assessmentId: string) {
  return withLock(`assessment:${userId}`, async () => {
    const previous = await prisma.assessment.findFirst({
      where: { id: assessmentId, userId },
      select: {
        id: true,
        sourceType: true,
        cvId: true,
        jobId: true,
        skills: true,
        type: true,
        difficulty: true,
        focus: true,
        questionCount: true,
        timeLimitMinutes: true,
      },
    });
    if (!previous) throw new AssessmentError("ASSESSMENT_NOT_FOUND");
    if (!previous.cvId) throw new AssessmentError("SOURCE_DELETED");
    const config = {
      type: previous.type,
      difficulty: previous.difficulty,
      focus: previous.focus,
      questionCount: previous.questionCount,
      timeLimitMinutes: previous.timeLimitMinutes,
    };
    let input: CreateAssessmentData;
    if (previous.sourceType === "JOB_MATCH") {
      if (!previous.jobId) throw new AssessmentError("SOURCE_DELETED");
      input = { source: "JOB_MATCH", jobId: previous.jobId, ...config };
    } else if (previous.sourceType === "CAREER_GOAL") {
      input = { source: "CAREER_GOAL", cvId: previous.cvId, ...config };
    } else {
      input = {
        source: previous.sourceType,
        cvId: previous.cvId,
        skills: previous.skills,
        ...config,
      };
    }
    return startOrReuse(await resolveSources(userId, input), previous.id);
  });
}

/* ─── Generation ────────────────────────────────────────────────────────────── */

export async function runAssessmentGeneration(
  assessmentId: string,
  skills: SkillContext[],
  target: { title: string; company: string | null },
): Promise<void> {
  const claimed = await prisma.assessment.updateMany({
    where: { id: assessmentId, status: "DRAFT" },
    data: { status: "GENERATING", stage: "PREPARING" },
  });
  if (claimed.count === 0) return;

  const setStage = async (stage: "GENERATING" | "VALIDATING" | "FINALIZING") => {
    await prisma.assessment.update({ where: { id: assessmentId }, data: { stage } });
  };

  try {
    const a = await prisma.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      select: {
        title: true,
        type: true,
        focus: true,
        difficulty: true,
        questionCount: true,
        user: { select: { profile: { select: { experienceLevel: true } } } },
        cvAnalysis: { select: { result: true } },
      },
    });
    const cvReport = a.cvAnalysis ? cvAnalysisReportSchema.safeParse(a.cvAnalysis.result) : null;
    const experienceLevel =
      EXPERIENCE_LEVELS.find((l) => l.value === a.user.profile?.experienceLevel)?.label ??
      (cvReport?.success
        ? CV_LEVEL_LABELS[cvReport.data.candidateProfile.experienceLevel]
        : undefined) ??
      "Not specified";
    const slots = buildPlan(skills, a);
    const generated = await generateAssessmentQuestions(
      { title: a.title, target, type: a.type, focus: a.focus, experienceLevel, skills, slots },
      getAIProvider(),
      setStage,
    );
    await setStage("FINALIZING");
    await prisma.$transaction([
      prisma.assessmentQuestion.createMany({
        data: generated.questions.map((q) => ({
          assessmentId,
          position: q.position,
          type: q.type,
          skill: q.skill,
          difficulty: q.difficulty,
          scenario: q.scenario,
          prompt: q.prompt,
          options: q.options ?? undefined,
          correctAnswer: q.correctAnswer,
          expectedPoints: q.expectedPoints,
          explanation: q.explanation,
          source: q.source,
          sourceReason: q.sourceReason,
        })),
      }),
      prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: "IN_PROGRESS",
          provider: generated.provider,
          model: generated.model,
          assessmentVersion: ASSESSMENT_VERSION,
        },
      }),
    ]);
  } catch (error) {
    const code = errorCodeOf(error);
    console.error(`[assessment] generation ${assessmentId} failed: ${code}`);
    await prisma.assessment
      .update({
        where: { id: assessmentId },
        data: { status: "FAILED", errorCode: code, completedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

export async function expireStaleAssessments(scope: { userId: string } | { assessmentId: string }) {
  await prisma.assessment.updateMany({
    where: {
      status: { in: [...GENERATING] },
      updatedAt: { lt: new Date(Date.now() - staleAfterMs()) },
      ...("userId" in scope ? { userId: scope.userId } : { id: scope.assessmentId }),
    },
    data: { status: "FAILED", errorCode: "GENERATION_INTERRUPTED", completedAt: new Date() },
  });
}

export async function deleteAssessment(userId: string, assessmentId: string): Promise<boolean> {
  const deleted = await prisma.assessment.deleteMany({ where: { id: assessmentId, userId } });
  return deleted.count > 0;
}

/* ─── Taking the assessment ─────────────────────────────────────────────────── */

/** Starts the timer. Idempotent: a second call keeps the original start time. */
export async function startAssessment(userId: string, assessmentId: string) {
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, userId },
    select: { status: true, startedAt: true, timeLimitMinutes: true },
  });
  if (!a) throw new AssessmentError("ASSESSMENT_NOT_FOUND");
  if (isFinished(a.status)) throw new AssessmentError("ALREADY_FINISHED");
  if (a.status !== "IN_PROGRESS") throw new AssessmentError("NOT_ACTIVE");
  if (a.startedAt) return;
  const now = new Date();
  await prisma.assessment.updateMany({
    where: { id: assessmentId, userId, status: "IN_PROGRESS", startedAt: null },
    data: { startedAt: now, expiresAt: deadlineFrom(now, a.timeLimitMinutes) },
  });
}

/** Loads a question only if its assessment belongs to the user. */
async function ownedQuestion(userId: string, questionId: string) {
  const question = await prisma.assessmentQuestion.findFirst({
    where: { id: questionId, assessment: { userId } },
    select: {
      id: true,
      assessmentId: true,
      type: true,
      options: true,
      correctAnswer: true,
      status: true,
      assessment: { select: { status: true, startedAt: true, expiresAt: true } },
    },
  });
  // Another user's question is indistinguishable from a missing one.
  if (!question) throw new AssessmentError("QUESTION_NOT_FOUND");
  return question;
}

function validResponse(type: QuestionType, options: unknown, response: string): boolean {
  if (type === "TRUE_FALSE") return response === "true" || response === "false";
  if (type === "MULTIPLE_CHOICE") {
    return Array.isArray(options) && options.some((o) => (o as { id?: string }).id === response);
  }
  return response.trim().length > 0;
}

/**
 * Saves (and locks) one answer. Objective answers are graded here on the
 * server; the result is not revealed until the assessment is submitted.
 */
export async function saveAnswer(userId: string, questionId: string, response: string) {
  const first = await ownedQuestion(userId, questionId);
  return withLock(`assessment-run:${first.assessmentId}`, async () => {
    const q = await ownedQuestion(userId, questionId);
    const blocker = answerBlocker(q.assessment, q.status);
    if (blocker) throw new AssessmentError(blocker);
    if (!validResponse(q.type, q.options, response)) throw new AssessmentError("INVALID_ANSWER");

    const objective = isObjective(q.type);
    const correct = objective ? isCorrectObjective(q.type, q.correctAnswer, response) : null;
    await prisma.$transaction(async (tx) => {
      // The status guard makes a second concurrent submission a no-op.
      const moved = await tx.assessmentQuestion.updateMany({
        where: { id: questionId, status: "PENDING", assessment: { userId, status: "IN_PROGRESS" } },
        data: { status: "ANSWERED" },
      });
      if (moved.count === 0) throw new AssessmentError("ALREADY_ANSWERED");
      await tx.assessmentAnswer.create({
        data: {
          questionId,
          response,
          ...(objective
            ? {
                status: "EVALUATED",
                isCorrect: correct,
                score: correct ? 1 : 0,
                evaluatedAt: new Date(),
              }
            : { status: "SUBMITTED" }),
        },
      });
    });
  });
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

/**
 * Submits the assessment (or finalizes it after the time limit). Unanswered
 * questions become skipped, open answers are evaluated, and every score is
 * computed here. Submitting an already-finished assessment is a no-op.
 */
export async function submitAssessment(userId: string, assessmentId: string) {
  return withLock(`assessment-run:${assessmentId}`, async () => {
    const a = await prisma.assessment.findFirst({
      where: { id: assessmentId, userId },
      select: {
        id: true,
        title: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        skills: true,
        job: { select: { title: true } },
        roadmap: {
          select: { userId: true, items: { select: { title: true, skill: true, status: true } } },
        },
      },
    });
    if (!a) throw new AssessmentError("ASSESSMENT_NOT_FOUND");
    if (isFinished(a.status)) return { status: a.status, alreadyFinished: true };
    if (a.status !== "IN_PROGRESS") throw new AssessmentError("NOT_ACTIVE");
    if (!a.startedAt) throw new AssessmentError("NOT_STARTED");
    const expired = isPastDeadline(a.expiresAt);

    await prisma.assessmentQuestion.updateMany({
      where: { assessmentId, status: "PENDING" },
      data: { status: "SKIPPED" },
    });

    const questions = await prisma.assessmentQuestion.findMany({
      where: { assessmentId },
      orderBy: { position: "asc" },
      select: {
        id: true,
        type: true,
        skill: true,
        difficulty: true,
        scenario: true,
        prompt: true,
        expectedPoints: true,
        explanation: true,
        status: true,
        answer: { select: { id: true, status: true, response: true, score: true } },
      },
    });

    // Evaluate open answers that don't have a score yet.
    const toEvaluate = questions.filter((q) => q.answer && q.answer.status !== "EVALUATED");
    let failed = 0;
    await mapLimit(toEvaluate, EVALUATION_CONCURRENCY, async (q) => {
      try {
        const e = await evaluateOpenAnswer(
          // Question difficulties come only from the plan (never the Phase 8 "EXPERT" value).
          {
            question: { ...q, difficulty: q.difficulty as QuestionLevel },
            response: q.answer!.response,
          },
          getAIProvider(),
        );
        await prisma.assessmentAnswer.update({
          where: { id: q.answer!.id },
          data: {
            status: "EVALUATED",
            accuracy: e.accuracy,
            relevance: e.relevance,
            completeness: e.completeness,
            clarity: e.clarity,
            technicalDepth: e.technicalDepth,
            feedback: e.feedback,
            score: e.points,
            errorCode: null,
            evaluatedAt: new Date(),
          },
        });
        q.answer!.score = e.points;
      } catch (error) {
        failed++;
        const code = errorCodeOf(error);
        console.error(`[assessment] evaluation of question ${q.id} failed: ${code}`);
        await prisma.assessmentAnswer
          .update({ where: { id: q.answer!.id }, data: { status: "FAILED", errorCode: code } })
          .catch(() => undefined);
      }
    });
    if (failed > 0) throw new AssessmentError("SCORING_FAILED");

    const scored = questions.map((q) => ({
      type: q.type,
      skill: q.skill,
      points: q.answer?.score ?? null,
    }));
    const scores = computeScores(scored, a.skills);
    const candidates = questions.map((q) => ({
      skill: q.skill,
      prompt: q.prompt,
      points: q.answer?.score ?? null,
    }));
    const ai = await analyzeResults(
      {
        title: a.title,
        skills: scores.skills,
        categories: scores.categories,
        missed: questions
          .filter((q) => (q.answer?.score ?? 0) < 0.6)
          .slice(0, 10)
          .map((q) => ({
            skill: q.skill,
            type: q.type,
            prompt: q.prompt,
            explanation: q.explanation,
          })),
        jobTitle: a.job?.title ?? null,
      },
      getAIProvider(),
    );
    const insights = ai ?? ruleInsights(scores.skills, scores.categories, candidates);
    // Defence in depth: only the owner's roadmap tasks are ever linked (read-only).
    const tasks = a.roadmap?.userId === userId ? a.roadmap.items : [];
    const recommendations = mergeRecommendations(
      roadmapRecommendations(scores.skills, tasks),
      insights.recommendations,
    );
    const reviewTopics =
      insights.reviewTopics.length > 0 ? insights.reviewTopics : reviewTopicsFrom(candidates);
    const status = expired ? "EXPIRED" : "COMPLETED";

    await prisma.$transaction(async (tx) => {
      const done = await tx.assessment.updateMany({
        where: { id: assessmentId, userId, status: "IN_PROGRESS" },
        data: { status, completedAt: new Date() },
      });
      if (done.count === 0) throw new AssessmentError("ALREADY_FINISHED");
      await tx.assessmentResult.create({
        data: {
          assessmentId,
          rawScore: scores.rawScore,
          maxScore: scores.maxScore,
          percentage: scores.percentage,
          level: scores.level,
          skillBreakdown: scores.skills,
          categoryBreakdown: scores.categories,
          strengths: insights.strengths,
          improvementAreas: insights.improvementAreas,
          recommendations,
          reviewTopics,
          insightsSource: ai ? "ai" : "rules",
          timeExpired: expired,
        },
      });
    });
    return { status, alreadyFinished: false };
  });
}
