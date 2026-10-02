import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership, state and duplicate-request rules for AI Interview against a fake
 * database holding two users' data. The session user is "user-a".
 */
type Q = {
  id: string;
  interviewId: string;
  userId: string;
  status: "PENDING" | "ANSWERED" | "SKIPPED";
  interviewStatus: "IN_PROGRESS" | "COMPLETED" | "GENERATING";
  followUpIndex: number;
  answer: null | { id: string; status: "EVALUATING" | "EVALUATED" | "FAILED"; content: string };
};

const db = vi.hoisted(() => ({
  cvs: [
    { id: "cv-a", userId: "user-a", analyzed: true },
    { id: "cv-a-new", userId: "user-a", analyzed: false },
    { id: "cv-b", userId: "user-b", analyzed: true },
  ],
  jobs: [
    { id: "job-a", userId: "user-a", run: { id: "run-a", cvId: "cv-a" as string | null } },
    { id: "job-a-pending", userId: "user-a", run: null },
    { id: "job-b", userId: "user-b", run: { id: "run-b", cvId: "cv-b" } },
  ],
  goals: { "user-a": "DATA_SCIENTIST" as string | null } as Record<string, string | null>,
  interviews: [
    { id: "int-a", userId: "user-a", sourceType: "JOB_MATCH", cvId: "cv-a", jobId: "job-a" },
    { id: "int-b", userId: "user-b", sourceType: "JOB_MATCH", cvId: "cv-b", jobId: "job-b" },
  ],
  questions: [] as Q[],
  running: null as null | { id: string },
  created: [] as Record<string, unknown>[],
  answersCreated: [] as string[],
  updatedQuestions: [] as string[],
  deleteWhere: [] as unknown[],
  createDelayMs: 0,
  duplicateWhere: null as unknown,
}));

const freshQuestions = (): Q[] => [
  {
    id: "qa1",
    interviewId: "int-a",
    userId: "user-a",
    status: "PENDING",
    interviewStatus: "IN_PROGRESS",
    followUpIndex: 0,
    answer: null,
  },
  {
    id: "qa-done",
    interviewId: "int-done",
    userId: "user-a",
    status: "PENDING",
    interviewStatus: "COMPLETED",
    followUpIndex: 0,
    answer: null,
  },
  {
    id: "qa-answered",
    interviewId: "int-a",
    userId: "user-a",
    status: "ANSWERED",
    interviewStatus: "IN_PROGRESS",
    followUpIndex: 0,
    answer: { id: "ans-1", status: "EVALUATED", content: "x" },
  },
  {
    id: "qb1",
    interviewId: "int-b",
    userId: "user-b",
    status: "PENDING",
    interviewStatus: "IN_PROGRESS",
    followUpIndex: 0,
    answer: { id: "ans-b", status: "FAILED", content: "B's private answer" },
  },
];

type Where = Record<string, unknown> & { id?: string; userId?: string };

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock", NODE_ENV: "test" }),
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/db/prisma", () => {
  const findQuestion = (where: { id: string; interview: { userId: string } }) => {
    const q = db.questions.find((x) => x.id === where.id && x.userId === where.interview.userId);
    return q
      ? {
          ...q,
          position: 1,
          kind: "TECHNICAL",
          prompt: "How would you deploy a model?",
          skill: "Kubernetes",
          source: "JOB_MATCH",
          sourceReason: "r",
          sourceEvidence: null,
          interview: { status: q.interviewStatus, target: "ML Engineer", difficulty: "ENTRY" },
        }
      : null;
  };
  const prisma = {
    cV: {
      findFirst: async ({ where }: { where: Where }) => {
        const cv = db.cvs.find((c) => c.id === where.id && c.userId === where.userId);
        return cv ? { id: cv.id, analyses: cv.analyzed ? [{ id: `an-${cv.id}` }] : [] } : null;
      },
    },
    job: {
      findFirst: async ({ where }: { where: Where }) => {
        const job = db.jobs.find((j) => j.id === where.id && j.userId === where.userId);
        return job
          ? { id: job.id, title: "ML Engineer", analyses: job.run ? [job.run] : [] }
          : null;
      },
    },
    profile: {
      findUnique: async ({ where }: { where: { userId: string } }) => ({
        careerGoal: db.goals[where.userId] ?? null,
      }),
    },
    roadmap: { findFirst: async () => null },
    interview: {
      findFirst: async ({ where }: { where: Where }) => {
        // The duplicate check (running or just-created interview with the same settings).
        if (where.OR || where.status) {
          db.duplicateWhere = where;
          return db.running;
        }
        const found = db.interviews.find((i) => i.id === where.id && i.userId === where.userId);
        return found
          ? {
              ...found,
              type: "MIXED",
              difficulty: "ENTRY",
              focus: "MISSING_SKILLS",
              questionCount: 10,
            }
          : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (db.createDelayMs) await new Promise((r) => setTimeout(r, db.createDelayMs));
        db.created.push(data);
        const id = `int-new-${db.created.length}`;
        db.running = { id };
        return { id };
      },
      updateMany: async () => ({ count: 0 }),
      deleteMany: async ({ where }: { where: Where }) => {
        db.deleteWhere.push(where);
        return {
          count: db.interviews.filter((i) => i.id === where.id && i.userId === where.userId).length,
        };
      },
    },
    interviewQuestion: {
      findFirst: async ({ where }: { where: { id: string; interview: { userId: string } } }) =>
        findQuestion(where),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string; interview: { userId: string; status: string } };
        data: { status: Q["status"] };
      }) => {
        const q = db.questions.find(
          (x) =>
            x.id === where.id &&
            x.status === where.status &&
            x.userId === where.interview.userId &&
            x.interviewStatus === where.interview.status,
        );
        if (!q) return { count: 0 };
        q.status = data.status;
        db.updatedQuestions.push(q.id);
        return { count: 1 };
      },
      create: async () => ({ id: "follow-up" }),
    },
    interviewAnswer: {
      create: async ({ data }: { data: { questionId: string; content: string } }) => {
        db.answersCreated.push(data.questionId);
        const q = db.questions.find((x) => x.id === data.questionId)!;
        q.answer = { id: `ans-${data.questionId}`, status: "EVALUATING", content: data.content };
        return { id: q.answer.id };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: "EVALUATED" | "FAILED" | "EVALUATING" };
      }) => {
        const q = db.questions.find((x) => x.answer?.id === where.id)!;
        q.answer!.status = data.status;
        return q.answer;
      },
    },
    $transaction: async (arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
  };
  return { prisma };
});

import {
  ANSWER_SUBMISSIONS_PER_HOUR,
  answerSubmissionLimiter,
  INTERVIEW_GENERATIONS_PER_HOUR,
  interviewGenerationLimiter,
} from "@/lib/interview/rate-limits";
import {
  DUPLICATE_WINDOW_MS,
  createInterview,
  deleteInterview,
  practiceAgain,
  retryEvaluation,
  skipQuestion,
  submitAnswer,
} from "@/lib/interview/service";

const config = {
  type: "MIXED" as const,
  difficulty: "ENTRY" as const,
  questionCount: 10,
  focus: "MISSING_SKILLS" as const,
};

beforeEach(() => {
  db.running = null;
  db.created.length = 0;
  db.answersCreated.length = 0;
  db.updatedQuestions.length = 0;
  db.deleteWhere.length = 0;
  db.createDelayMs = 0;
  db.goals["user-a"] = "DATA_SCIENTIST";
  db.questions = freshQuestions();
});

describe("interview sources and ownership", () => {
  it("refuses another user's job match exactly like a missing one", async () => {
    for (const jobId of ["job-b", "missing"]) {
      await expect(
        createInterview("user-a", { source: "JOB_MATCH", jobId, ...config }),
      ).rejects.toMatchObject({
        code: "JOB_MATCH_NOT_FOUND",
      });
    }
    await expect(
      createInterview("user-a", { source: "JOB_MATCH", jobId: "job-a-pending", ...config }),
    ).rejects.toMatchObject({
      code: "JOB_MATCH_NOT_READY",
    });
    expect(db.created).toEqual([]);
  });

  it("refuses another user's CV, unanalyzed CVs and a missing career goal", async () => {
    const career = { source: "CAREER_GOAL" as const, ...config };
    await expect(createInterview("user-a", { ...career, cvId: "cv-b" })).rejects.toMatchObject({
      code: "CV_NOT_FOUND",
    });
    await expect(createInterview("user-a", { ...career, cvId: "cv-a-new" })).rejects.toMatchObject({
      code: "CV_NOT_ANALYZED",
    });
    db.goals["user-a"] = null;
    await expect(createInterview("user-a", { ...career, cvId: "cv-a" })).rejects.toMatchObject({
      code: "NO_CAREER_GOAL",
    });
    expect(db.created).toEqual([]);
  });

  it("creates interviews owned by the session user from their own sources", async () => {
    await createInterview("user-a", { source: "JOB_MATCH", jobId: "job-a", ...config });
    expect(db.created[0]).toMatchObject({
      userId: "user-a",
      jobId: "job-a",
      cvId: "cv-a",
      sourceType: "JOB_MATCH",
    });
    await createInterview("user-a", {
      source: "CAREER_GOAL",
      cvId: "cv-a",
      ...config,
      focus: "GENERAL",
    });
  });

  it("can't practice again with or delete another user's interview", async () => {
    await expect(practiceAgain("user-a", "int-b")).rejects.toMatchObject({
      code: "INTERVIEW_NOT_FOUND",
    });
    expect(await deleteInterview("user-a", "int-b")).toBe(false);
    expect(db.deleteWhere).toEqual([{ id: "int-b", userId: "user-a" }]);
  });

  it("practice again creates a new interview linked to the old one", async () => {
    const result = await practiceAgain("user-a", "int-a");
    expect(result.reused).toBe(false);
    expect(db.created[0]).toMatchObject({ practiceOfId: "int-a", jobId: "job-a" });
  });
});

describe("questions and answers", () => {
  it("refuses another user's question exactly like a missing one", async () => {
    for (const id of ["qb1", "missing"]) {
      await expect(submitAnswer("user-a", id, "My answer")).rejects.toMatchObject({
        code: "QUESTION_NOT_FOUND",
      });
      await expect(skipQuestion("user-a", id)).rejects.toMatchObject({
        code: "QUESTION_NOT_FOUND",
      });
      await expect(retryEvaluation("user-a", id)).rejects.toMatchObject({
        code: "QUESTION_NOT_FOUND",
      });
    }
    expect(db.answersCreated).toEqual([]);
    expect(db.questions.find((q) => q.id === "qb1")!.answer!.status).toBe("FAILED");
  });

  it("rejects answers to completed interviews and already-answered questions", async () => {
    await expect(submitAnswer("user-a", "qa-done", "Late answer")).rejects.toMatchObject({
      code: "INTERVIEW_COMPLETED",
    });
    await expect(submitAnswer("user-a", "qa-answered", "Second answer")).rejects.toMatchObject({
      code: "ALREADY_ANSWERED",
    });
    await expect(retryEvaluation("user-a", "qa-answered")).rejects.toMatchObject({
      code: "EVALUATION_NOT_FAILED",
    });
    expect(db.answersCreated).toEqual([]);
  });

  it("accepts one answer per question even when submitted twice at once", async () => {
    const results = await Promise.allSettled([
      submitAnswer("user-a", "qa1", "I would use Kubernetes."),
      submitAnswer("user-a", "qa1", "I would use Kubernetes."),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "ALREADY_ANSWERED" },
    });
    expect(db.answersCreated).toEqual(["qa1"]);
    expect(db.questions.find((q) => q.id === "qa1")!.answer!.status).toBe("EVALUATED");
  });
});

describe("duplicate generation and rate limits", () => {
  it("joins a running generation with the same configuration", async () => {
    db.running = { id: "int-running" };
    expect(
      await createInterview("user-a", { source: "JOB_MATCH", jobId: "job-a", ...config }),
    ).toEqual({
      interviewId: "int-running",
      reused: true,
    });
    expect(db.created).toEqual([]);
  });

  it("treats an identical request within the duplicate window as the same interview, even if it already finished", async () => {
    await createInterview("user-a", { source: "JOB_MATCH", jobId: "job-a", ...config });
    const where = db.duplicateWhere as {
      userId: string;
      practiceOfId: string | null;
      OR: [{ status: { in: string[] } }, { status: { not: string }; createdAt: { gte: Date } }];
    };
    expect(where.userId).toBe("user-a");
    expect(where.practiceOfId).toBeNull();
    expect(where.OR[0].status.in).toEqual(["DRAFT", "GENERATING"]);
    // Completed (or in-progress) interviews created moments ago are reused; failed ones never are.
    expect(where.OR[1].status).toEqual({ not: "FAILED" });
    const windowMs = Date.now() - where.OR[1].createdAt.gte.getTime();
    expect(windowMs).toBeGreaterThanOrEqual(DUPLICATE_WINDOW_MS - 50);
    expect(windowMs).toBeLessThan(DUPLICATE_WINDOW_MS + 1_000);
  });

  it("concurrent requests start only one generation", async () => {
    db.createDelayMs = 20;
    const results = await Promise.all([
      createInterview("user-a", { source: "JOB_MATCH", jobId: "job-a", ...config }),
      createInterview("user-a", { source: "JOB_MATCH", jobId: "job-a", ...config }),
    ]);
    expect(db.created).toHaveLength(1);
    expect(results[0]!.interviewId).toBe(results[1]!.interviewId);
  });

  it("limits generations and answers per user, separately", async () => {
    const user = `limit-${Date.now()}`;
    for (let i = 0; i < INTERVIEW_GENERATIONS_PER_HOUR; i++)
      expect((await interviewGenerationLimiter(user)).ok).toBe(true);
    expect((await interviewGenerationLimiter(user)).ok).toBe(false);
    // Answers use their own budget.
    expect((await answerSubmissionLimiter(user)).ok).toBe(true);
    for (let i = 1; i < ANSWER_SUBMISSIONS_PER_HOUR; i++) await answerSubmissionLimiter(user);
    expect((await answerSubmissionLimiter(user)).ok).toBe(false);
    expect((await interviewGenerationLimiter(`${user}-other`)).ok).toBe(true);
  });
});
