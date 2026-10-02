import "server-only";
import { after } from "next/server";
import {
  evaluateInterviewAnswer,
  generateInterviewQuestions,
  type InterviewGenerationInput,
} from "@/lib/ai/interview";
import { AIConfigurationError, getAIProvider } from "@/lib/ai/provider";
import { cvAnalysisReportSchema } from "@/lib/cv/analysis-schema";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { jobMatchReportSchema } from "@/lib/job-match/schema";
import { careerGoalLabel, EXPERIENCE_LEVELS } from "@/lib/profile/options";
import { roadmapReportSchema } from "@/lib/roadmap/schema";
import { createKeyedLock } from "@/lib/security/keyed-lock";
import { InterviewError, type InterviewErrorCode } from "./errors";
import { finishBlocker } from "./progress";
import { buildInterviewReport } from "./report";
import { answerBlocker, canAddFollowUp } from "./state";
import type { CreateInterviewData, InterviewConfig } from "./validation";

/**
 * AI Interview pipeline. Every entry point takes the owner's id from the
 * session and scopes every query by it. Logs carry ids and error codes only —
 * never answers, prompts, CV text, job descriptions or AI output.
 */

const GENERATING = ["DRAFT", "GENERATING"] as const;
/** Identical start requests this close together are one request (double-click, two tabs). */
export const DUPLICATE_WINDOW_MS = 10_000;
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
  return getEnv().AI_TIMEOUT_MS * 3 + 60_000;
}

function errorCodeOf(error: unknown): InterviewErrorCode {
  if (error instanceof InterviewError) return error.code;
  if (error instanceof AIConfigurationError) return "AI_UNAVAILABLE";
  return "UNKNOWN";
}

/* ─── Sources ───────────────────────────────────────────────────────────────── */

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
  if (!cv) throw new InterviewError("CV_NOT_FOUND");
  const analysisId = cv.analyses[0]?.id;
  if (!analysisId) throw new InterviewError("CV_NOT_ANALYZED");
  return { cvId: cv.id, cvAnalysisId: analysisId };
}

async function requireCompletedJobMatch(userId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      title: true,
      analyses: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, cvId: true },
      },
    },
  });
  if (!job) throw new InterviewError("JOB_MATCH_NOT_FOUND");
  const run = job.analyses[0];
  if (!run) throw new InterviewError("JOB_MATCH_NOT_READY");
  if (!run.cvId) throw new InterviewError("SOURCE_DELETED");
  return { job, jobAnalysisId: run.id, cvId: run.cvId };
}

/** The latest completed roadmap for the same target, if any (optional context). */
async function findRoadmap(
  userId: string,
  where: { jobId: string } | { careerGoal: NonNullable<Awaited<ReturnType<typeof profileGoal>>> },
) {
  const roadmap = await prisma.roadmap.findFirst({
    where: {
      userId,
      status: "COMPLETED",
      ...("jobId" in where
        ? { jobId: where.jobId }
        : { sourceType: "CAREER_GOAL", careerGoal: where.careerGoal }),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return roadmap?.id ?? null;
}

async function profileGoal(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { careerGoal: true },
  });
  return profile?.careerGoal ?? null;
}

type StartData = {
  userId: string;
  sourceType: "JOB_MATCH" | "CAREER_GOAL";
  target: string;
  cvId: string;
  cvAnalysisId: string;
  jobId?: string;
  jobAnalysisId?: string;
  careerGoal?: NonNullable<Awaited<ReturnType<typeof profileGoal>>>;
  roadmapId: string | null;
  practiceOfId?: string;
} & InterviewConfig;

/** Resolves and ownership-checks every source for a new interview. */
async function resolveSources(
  userId: string,
  data: CreateInterviewData,
): Promise<Omit<StartData, "practiceOfId">> {
  const config: InterviewConfig = {
    type: data.type,
    difficulty: data.difficulty,
    questionCount: data.questionCount,
    focus: data.focus,
  };
  if (data.source === "JOB_MATCH") {
    const { job, jobAnalysisId, cvId } = await requireCompletedJobMatch(userId, data.jobId);
    const cv = await requireAnalyzedCv(userId, cvId);
    return {
      userId,
      sourceType: "JOB_MATCH",
      target: job.title ?? "Untitled job",
      ...cv,
      jobId: job.id,
      jobAnalysisId,
      roadmapId: await findRoadmap(userId, { jobId: job.id }),
      ...config,
    };
  }
  const goal = await profileGoal(userId);
  if (!goal) throw new InterviewError("NO_CAREER_GOAL");
  const cv = await requireAnalyzedCv(userId, data.cvId);
  return {
    userId,
    sourceType: "CAREER_GOAL",
    target: careerGoalLabel(goal) ?? "Career goal",
    ...cv,
    careerGoal: goal,
    roadmapId: await findRoadmap(userId, { careerGoal: goal }),
    ...config,
  };
}

/* ─── Create / practice again ───────────────────────────────────────────────── */

async function startOrReuse(data: StartData): Promise<{ interviewId: string; reused: boolean }> {
  await expireStaleInterviews({ userId: data.userId });
  // A double-click (or two tabs) with the same source and settings joins the running generation,
  // or the interview it just produced — however fast generation was. Failed ones are never reused.
  const running = await prisma.interview.findFirst({
    where: {
      userId: data.userId,
      OR: [
        { status: { in: [...GENERATING] } },
        {
          status: { not: "FAILED" },
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
      ],
      practiceOfId: data.practiceOfId ?? null,
      sourceType: data.sourceType,
      jobId: data.jobId ?? null,
      cvId: data.cvId,
      type: data.type,
      difficulty: data.difficulty,
      focus: data.focus,
      questionCount: data.questionCount,
    },
    select: { id: true },
  });
  if (running) return { interviewId: running.id, reused: true };

  const interview = await prisma.interview.create({
    data: { ...data, provider: getEnv().AI_PROVIDER },
    select: { id: true },
  });
  after(() => runInterviewGeneration(interview.id));
  return { interviewId: interview.id, reused: false };
}

export async function createInterview(userId: string, data: CreateInterviewData) {
  return withLock(`interview:${userId}`, async () =>
    startOrReuse(await resolveSources(userId, data)),
  );
}

/** Creates a new interview with the same sources and settings. The old one is kept. */
export async function practiceAgain(userId: string, interviewId: string) {
  return withLock(`interview:${userId}`, async () => {
    const previous = await prisma.interview.findFirst({
      where: { id: interviewId, userId },
      select: {
        id: true,
        sourceType: true,
        cvId: true,
        jobId: true,
        type: true,
        difficulty: true,
        focus: true,
        questionCount: true,
      },
    });
    if (!previous) throw new InterviewError("INTERVIEW_NOT_FOUND");
    if (!previous.cvId) throw new InterviewError("SOURCE_DELETED");
    const config = {
      type: previous.type,
      difficulty: previous.difficulty,
      focus: previous.focus,
      questionCount: previous.questionCount,
    };
    let data: CreateInterviewData;
    if (previous.sourceType === "JOB_MATCH") {
      if (!previous.jobId) throw new InterviewError("SOURCE_DELETED");
      data = { source: "JOB_MATCH", jobId: previous.jobId, ...config };
    } else {
      // Career-goal interviews are created without the job-only focus; keep that invariant.
      const focus = config.focus === "JOB_REQUIREMENTS" ? "GENERAL" : config.focus;
      data = { source: "CAREER_GOAL", cvId: previous.cvId, ...config, focus };
    }
    return startOrReuse({ ...(await resolveSources(userId, data)), practiceOfId: previous.id });
  });
}

/* ─── Generation ────────────────────────────────────────────────────────────── */

async function buildGenerationInput(interviewId: string): Promise<InterviewGenerationInput> {
  const interview = await prisma.interview.findUniqueOrThrow({
    where: { id: interviewId },
    select: {
      sourceType: true,
      target: true,
      type: true,
      difficulty: true,
      focus: true,
      questionCount: true,
      user: { select: { profile: { select: { experienceLevel: true } } } },
      cv: { select: { extractedText: true, textTruncated: true } },
      cvAnalysis: { select: { result: true } },
      job: { select: { title: true, company: true, description: true } },
      jobAnalysis: { select: { result: true } },
      roadmap: { select: { result: true, items: { select: { skill: true } } } },
    },
  });
  if (!interview.cv || !interview.cvAnalysis) throw new InterviewError("SOURCE_DELETED");
  const cvReport = cvAnalysisReportSchema.safeParse(interview.cvAnalysis.result);
  if (!cvReport.success) throw new InterviewError("SOURCE_DELETED");

  const experienceLevel =
    EXPERIENCE_LEVELS.find((l) => l.value === interview.user.profile?.experienceLevel)?.label ??
    CV_LEVEL_LABELS[cvReport.data.candidateProfile.experienceLevel] ??
    "Not specified";

  let job: InterviewGenerationInput["job"] = null;
  if (interview.sourceType === "JOB_MATCH") {
    if (!interview.job || !interview.jobAnalysis) throw new InterviewError("SOURCE_DELETED");
    const match = jobMatchReportSchema.safeParse(interview.jobAnalysis.result);
    if (!match.success) throw new InterviewError("SOURCE_DELETED");
    job = {
      description: [interview.job.title, interview.job.description].filter(Boolean).join("\n"),
      requirements: match.data.requirements.map((r) => ({
        term: r.term,
        kind: r.kind,
        importance: r.importance,
        match: r.match,
        evidenceFromJob: r.evidenceFromJob,
      })),
      interviewTopics: match.data.interviewTopics,
    };
  }

  let roadmap: InterviewGenerationInput["roadmap"] = null;
  if (interview.roadmap) {
    const report = roadmapReportSchema.safeParse(interview.roadmap.result);
    roadmap = {
      gapSkills: report.success
        ? report.data.skillGaps.filter((g) => g.status !== "STRONG").map((g) => g.skill)
        : [],
      taskSkills: [...new Set(interview.roadmap.items.map((i) => i.skill))],
    };
  }

  return {
    source: interview.sourceType,
    target: { title: interview.target, company: interview.job?.company ?? null },
    config: {
      type: interview.type,
      difficulty: interview.difficulty,
      focus: interview.focus,
      questionCount: interview.questionCount,
    },
    experienceLevel,
    cvText: interview.cv.extractedText,
    cvTruncated: interview.cv.textTruncated,
    verifiedCvSkills: cvReport.data.skills.filter((s) => s.verified).map((s) => s.name),
    job,
    roadmap,
  };
}

export async function runInterviewGeneration(interviewId: string): Promise<void> {
  const claimed = await prisma.interview.updateMany({
    where: { id: interviewId, status: "DRAFT" },
    data: { status: "GENERATING", stage: "PREPARING", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  const setStage = async (stage: "GENERATING" | "VALIDATING" | "FINALIZING") => {
    await prisma.interview.update({ where: { id: interviewId }, data: { stage } });
  };

  try {
    const input = await buildGenerationInput(interviewId);
    const generated = await generateInterviewQuestions(input, getAIProvider(), setStage);
    await setStage("FINALIZING");
    await prisma.$transaction([
      prisma.interviewQuestion.createMany({
        data: generated.questions.map((q) => ({
          interviewId,
          position: q.position,
          kind: q.kind,
          prompt: q.prompt,
          skill: q.skill,
          source: q.source,
          sourceReason: q.sourceReason,
          sourceEvidence: q.sourceEvidence,
        })),
      }),
      prisma.interview.update({
        where: { id: interviewId },
        data: {
          status: "IN_PROGRESS",
          introduction: generated.introduction,
          provider: generated.provider,
          model: generated.model,
          interviewVersion: 1,
        },
      }),
    ]);
  } catch (error) {
    const code = errorCodeOf(error);
    console.error(`[interview] generation ${interviewId} failed: ${code}`);
    await prisma.interview
      .update({
        where: { id: interviewId },
        data: { status: "FAILED", errorCode: code, completedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

export async function expireStaleInterviews(scope: { userId: string } | { interviewId: string }) {
  await prisma.interview.updateMany({
    where: {
      status: { in: [...GENERATING] },
      updatedAt: { lt: new Date(Date.now() - staleAfterMs()) },
      ...("userId" in scope ? { userId: scope.userId } : { id: scope.interviewId }),
    },
    data: { status: "FAILED", errorCode: "GENERATION_INTERRUPTED", completedAt: new Date() },
  });
}

export async function deleteInterview(userId: string, interviewId: string): Promise<boolean> {
  const deleted = await prisma.interview.deleteMany({ where: { id: interviewId, userId } });
  return deleted.count > 0;
}

/* ─── Answering ─────────────────────────────────────────────────────────────── */

/** Loads a question only if its interview belongs to the user. */
async function ownedQuestion(userId: string, questionId: string) {
  const question = await prisma.interviewQuestion.findFirst({
    where: { id: questionId, interview: { userId } },
    select: {
      id: true,
      interviewId: true,
      position: true,
      followUpIndex: true,
      kind: true,
      prompt: true,
      skill: true,
      source: true,
      sourceReason: true,
      sourceEvidence: true,
      status: true,
      answer: { select: { id: true, status: true, content: true } },
      interview: { select: { status: true, target: true, difficulty: true } },
    },
  });
  // Another user's question is indistinguishable from a missing one.
  if (!question) throw new InterviewError("QUESTION_NOT_FOUND");
  return question;
}

type OwnedQuestion = Awaited<ReturnType<typeof ownedQuestion>>;

/**
 * Evaluates a saved answer and stores the result. On AI failure the answer is
 * kept (status FAILED) so the user can retry without retyping it.
 */
async function evaluateAndSave(question: OwnedQuestion, answerId: string, content: string) {
  try {
    const e = await evaluateInterviewAnswer(
      {
        question: {
          prompt: question.prompt,
          kind: question.kind,
          skill: question.skill,
          source: question.source,
          sourceReason: question.sourceReason,
          sourceEvidence: question.sourceEvidence,
          followUpIndex: question.followUpIndex,
        },
        answer: content,
        target: question.interview.target,
        difficulty: question.interview.difficulty,
      },
      getAIProvider(),
    );
    const followUpIndex = question.followUpIndex + 1;
    await prisma.$transaction([
      prisma.interviewAnswer.update({
        where: { id: answerId },
        data: {
          status: "EVALUATED",
          verdict: e.verdict,
          technicalAccuracy: e.technicalAccuracy,
          relevance: e.relevance,
          completeness: e.completeness,
          clarity: e.clarity,
          communication: e.communication,
          evidence: e.evidence,
          score: e.score,
          feedback: e.feedback,
          accuracyNote: e.accuracyNote,
          strengths: e.strengths,
          missingPoints: e.missingPoints,
          improvement: e.improvement,
          errorCode: null,
          evaluatedAt: new Date(),
        },
      }),
      ...(e.followUp && canAddFollowUp(question.followUpIndex)
        ? [
            prisma.interviewQuestion.create({
              data: {
                interviewId: question.interviewId,
                position: question.position,
                followUpIndex,
                parentQuestionId: question.id,
                kind: question.kind,
                prompt: e.followUp.prompt,
                skill: question.skill,
                source: question.source,
                sourceReason: `Follow-up: ${e.followUp.reason}`,
                sourceEvidence: question.sourceEvidence,
              },
            }),
          ]
        : []),
    ]);
    return { ok: true as const };
  } catch (error) {
    const code = errorCodeOf(error);
    console.error(`[interview] evaluation of question ${question.id} failed: ${code}`);
    await prisma.interviewAnswer
      .update({ where: { id: answerId }, data: { status: "FAILED", errorCode: code } })
      .catch(() => undefined);
    return { ok: false as const, code };
  }
}

/**
 * Saves an answer and evaluates it. Only a PENDING question of an IN_PROGRESS
 * interview owned by the user can be answered, and only once.
 */
export async function submitAnswer(userId: string, questionId: string, content: string) {
  const question = await ownedQuestion(userId, questionId);
  return withLock(`interview-answer:${question.interviewId}`, async () => {
    const fresh = await ownedQuestion(userId, questionId);
    const blocker = answerBlocker(fresh.interview.status, fresh.status);
    if (blocker) throw new InterviewError(blocker);

    // The status guard makes a second concurrent submission a no-op.
    const answer = await prisma.$transaction(async (tx) => {
      const moved = await tx.interviewQuestion.updateMany({
        where: { id: questionId, status: "PENDING", interview: { userId, status: "IN_PROGRESS" } },
        data: { status: "ANSWERED", answeredAt: new Date() },
      });
      if (moved.count === 0) throw new InterviewError("ALREADY_ANSWERED");
      return tx.interviewAnswer.create({ data: { questionId, content }, select: { id: true } });
    });
    return evaluateAndSave(fresh, answer.id, content);
  });
}

/** Retries a failed evaluation of an already-saved answer. */
export async function retryEvaluation(userId: string, questionId: string) {
  const question = await ownedQuestion(userId, questionId);
  return withLock(`interview-answer:${question.interviewId}`, async () => {
    const fresh = await ownedQuestion(userId, questionId);
    if (fresh.interview.status === "COMPLETED") throw new InterviewError("INTERVIEW_COMPLETED");
    if (fresh.interview.status !== "IN_PROGRESS") throw new InterviewError("INTERVIEW_NOT_ACTIVE");
    if (!fresh.answer) throw new InterviewError("QUESTION_NOT_ANSWERED");
    if (fresh.answer.status !== "FAILED") throw new InterviewError("EVALUATION_NOT_FAILED");
    await prisma.interviewAnswer.update({
      where: { id: fresh.answer.id },
      data: { status: "EVALUATING", errorCode: null },
    });
    return evaluateAndSave(fresh, fresh.answer.id, fresh.answer.content);
  });
}

export async function skipQuestion(userId: string, questionId: string) {
  const question = await ownedQuestion(userId, questionId);
  return withLock(`interview-answer:${question.interviewId}`, async () => {
    const fresh = await ownedQuestion(userId, questionId);
    const blocker = answerBlocker(fresh.interview.status, fresh.status);
    if (blocker) throw new InterviewError(blocker);
    const moved = await prisma.interviewQuestion.updateMany({
      where: { id: questionId, status: "PENDING", interview: { userId, status: "IN_PROGRESS" } },
      data: { status: "SKIPPED" },
    });
    if (moved.count === 0) throw new InterviewError("ALREADY_ANSWERED");
  });
}

/* ─── Completion ────────────────────────────────────────────────────────────── */

/** Finishes the interview and stores a report computed entirely in code. */
export async function completeInterview(userId: string, interviewId: string) {
  return withLock(`interview-answer:${interviewId}`, async () => {
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, userId },
      select: {
        status: true,
        sourceType: true,
        roadmap: {
          select: {
            userId: true,
            items: { select: { id: true, title: true, skill: true, status: true } },
          },
        },
        jobAnalysis: { select: { result: true } },
        cvAnalysis: { select: { result: true } },
        questions: {
          select: {
            id: true,
            position: true,
            followUpIndex: true,
            kind: true,
            prompt: true,
            skill: true,
            status: true,
            answer: {
              select: {
                status: true,
                score: true,
                verdict: true,
                technicalAccuracy: true,
                relevance: true,
                completeness: true,
                clarity: true,
                communication: true,
                evidence: true,
                strengths: true,
                missingPoints: true,
              },
            },
          },
        },
      },
    });
    if (!interview) throw new InterviewError("INTERVIEW_NOT_FOUND");
    if (interview.status === "COMPLETED") throw new InterviewError("INTERVIEW_COMPLETED");
    if (interview.status !== "IN_PROGRESS") throw new InterviewError("INTERVIEW_NOT_ACTIVE");
    const blocker = finishBlocker(interview.questions);
    if (blocker) throw new InterviewError(blocker);

    const match = interview.jobAnalysis
      ? jobMatchReportSchema.safeParse(interview.jobAnalysis.result)
      : null;
    const cvReport = interview.cvAnalysis
      ? cvAnalysisReportSchema.safeParse(interview.cvAnalysis.result)
      : null;
    const report = buildInterviewReport(
      interview.questions.map((q) => ({
        ...q,
        answer: q.answer
          ? {
              ...q.answer,
              relevance: q.answer.relevance ?? 0,
              completeness: q.answer.completeness ?? 0,
              clarity: q.answer.clarity ?? 0,
              communication: q.answer.communication ?? 0,
              evidence: q.answer.evidence ?? 0,
            }
          : null,
      })),
      {
        isJobInterview: interview.sourceType === "JOB_MATCH",
        // Defence in depth: only the owner's roadmap tasks are ever linked.
        roadmapTasks: interview.roadmap?.userId === userId ? interview.roadmap.items : [],
        jobRequirements: match?.success
          ? match.data.requirements.map((r) => ({ term: r.term, match: r.match }))
          : [],
        cvSkills: cvReport?.success
          ? cvReport.data.skills.filter((s) => s.verified).map((s) => s.name)
          : [],
      },
    );

    const done = await prisma.interview.updateMany({
      where: { id: interviewId, userId, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        result: report,
        overallScore: report.overallScore,
        completedAt: new Date(),
      },
    });
    if (done.count === 0) throw new InterviewError("INTERVIEW_COMPLETED");
    return report;
  });
}
