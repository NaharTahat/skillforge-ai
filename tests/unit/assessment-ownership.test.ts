import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership, integrity and duplicate-request rules for assessments against a
 * fake database holding two users' data. The session user is "user-a".
 */
type Q = {
  id: string;
  assessmentId: string;
  userId: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  options: { id: string; label: string }[] | null;
  correctAnswer: string | null;
  status: "PENDING" | "ANSWERED" | "SKIPPED";
  assessment: { status: string; startedAt: Date | null; expiresAt: Date | null };
};

const db = vi.hoisted(() => ({
  cvs: [
    { id: "cv-a", userId: "user-a", analyzed: true },
    { id: "cv-a-raw", userId: "user-a", analyzed: false },
    { id: "cv-b", userId: "user-b", analyzed: true },
  ],
  jobs: [
    { id: "job-a", userId: "user-a", cvId: "cv-a" },
    { id: "job-b", userId: "user-b", cvId: "cv-b" },
  ],
  goals: { "user-a": "DATA_SCIENTIST" as string | null } as Record<string, string | null>,
  assessments: [
    {
      id: "as-a",
      userId: "user-a",
      sourceType: "SKILL",
      cvId: "cv-a",
      jobId: null,
      skills: ["Python"],
    },
    {
      id: "as-b",
      userId: "user-b",
      sourceType: "SKILL",
      cvId: "cv-b",
      jobId: null,
      skills: ["Python"],
    },
  ],
  questions: [] as Q[],
  running: null as null | { id: string },
  duplicateWhere: null as unknown,
  created: [] as Record<string, unknown>[],
  answers: [] as Record<string, unknown>[],
  deleteWhere: [] as unknown[],
  createDelayMs: 0,
}));

const now = Date.now();
const fresh = (): Q[] => {
  const live = {
    status: "IN_PROGRESS",
    startedAt: new Date(now - 60_000),
    expiresAt: new Date(now + 600_000),
  };
  const opts = [
    { id: "a", label: "List" },
    { id: "b", label: "Dictionary" },
  ];
  return [
    {
      id: "qa-mc",
      assessmentId: "as-a",
      userId: "user-a",
      type: "MULTIPLE_CHOICE",
      options: opts,
      correctAnswer: "b",
      status: "PENDING",
      assessment: live,
    },
    {
      id: "qa-open",
      assessmentId: "as-a",
      userId: "user-a",
      type: "SHORT_ANSWER",
      options: null,
      correctAnswer: null,
      status: "PENDING",
      assessment: live,
    },
    {
      id: "qa-done",
      assessmentId: "as-a",
      userId: "user-a",
      type: "MULTIPLE_CHOICE",
      options: opts,
      correctAnswer: "b",
      status: "ANSWERED",
      assessment: live,
    },
    {
      id: "qa-expired",
      assessmentId: "as-x",
      userId: "user-a",
      type: "TRUE_FALSE",
      options: null,
      correctAnswer: "true",
      status: "PENDING",
      assessment: { ...live, expiresAt: new Date(now - 120_000) },
    },
    {
      id: "qa-unstarted",
      assessmentId: "as-y",
      userId: "user-a",
      type: "TRUE_FALSE",
      options: null,
      correctAnswer: "true",
      status: "PENDING",
      assessment: { ...live, startedAt: null },
    },
    {
      id: "qa-finished",
      assessmentId: "as-z",
      userId: "user-a",
      type: "TRUE_FALSE",
      options: null,
      correctAnswer: "true",
      status: "PENDING",
      assessment: { ...live, status: "COMPLETED" },
    },
    {
      id: "qb-mc",
      assessmentId: "as-b",
      userId: "user-b",
      type: "MULTIPLE_CHOICE",
      options: opts,
      correctAnswer: "b",
      status: "PENDING",
      assessment: live,
    },
  ];
};

type Where = Record<string, unknown> & { id?: string; userId?: string };

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock", NODE_ENV: "test" }),
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/db/prisma", () => {
  const cvResult = {
    reportVersion: 1,
    candidateProfile: { experienceLevel: "JUNIOR" },
    skills: [{ name: "Python", verified: true }],
  };
  const prisma = {
    cV: {
      findFirst: async ({ where }: { where: Where }) => {
        const cv = db.cvs.find((c) => c.id === where.id && c.userId === where.userId);
        return cv
          ? { id: cv.id, analyses: cv.analyzed ? [{ id: `an-${cv.id}`, result: cvResult }] : [] }
          : null;
      },
    },
    job: {
      findFirst: async ({ where }: { where: Where }) => {
        const job = db.jobs.find((j) => j.id === where.id && j.userId === where.userId);
        return job
          ? {
              id: job.id,
              title: "ML Engineer",
              company: null,
              analyses: [
                { id: `run-${job.id}`, cvId: job.cvId, result: { not: "a valid report" } },
              ],
            }
          : null;
      },
    },
    profile: {
      findUnique: async ({ where }: { where: { userId: string } }) => ({
        careerGoal: db.goals[where.userId] ?? null,
      }),
    },
    roadmap: { findFirst: async () => null },
    assessment: {
      findFirst: async ({ where }: { where: Where }) => {
        if (where.OR) {
          db.duplicateWhere = where;
          return db.running;
        }
        const a = db.assessments.find((x) => x.id === where.id && x.userId === where.userId);
        return a
          ? {
              ...a,
              type: "MIXED",
              difficulty: "ADAPTIVE",
              focus: "MIXED",
              questionCount: 10,
              timeLimitMinutes: 30,
              status: "IN_PROGRESS",
              startedAt: null,
            }
          : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (db.createDelayMs) await new Promise((r) => setTimeout(r, db.createDelayMs));
        db.created.push(data);
        const id = `as-new-${db.created.length}`;
        db.running = { id };
        return { id };
      },
      updateMany: async () => ({ count: 0 }),
      deleteMany: async ({ where }: { where: Where }) => {
        db.deleteWhere.push(where);
        return {
          count: db.assessments.filter((a) => a.id === where.id && a.userId === where.userId)
            .length,
        };
      },
    },
    assessmentQuestion: {
      findFirst: async ({ where }: { where: { id: string; assessment: { userId: string } } }) =>
        db.questions.find((q) => q.id === where.id && q.userId === where.assessment.userId) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string; assessment: { userId: string } };
        data: { status: Q["status"] };
      }) => {
        const q = db.questions.find(
          (x) =>
            x.id === where.id && x.status === where.status && x.userId === where.assessment.userId,
        );
        if (!q) return { count: 0 };
        q.status = data.status;
        return { count: 1 };
      },
    },
    assessmentAnswer: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.answers.push(data);
        return { id: `ans-${db.answers.length}` };
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
  answerSaveLimiter,
  ANSWER_SAVES_PER_HOUR,
  assessmentGenerationLimiter,
  ASSESSMENT_GENERATIONS_PER_HOUR,
  submissionLimiter,
  SUBMISSIONS_PER_HOUR,
} from "@/lib/assessment/rate-limits";
import {
  createAssessment,
  deleteAssessment,
  DUPLICATE_WINDOW_MS,
  practiceAgain,
  saveAnswer,
  startAssessment,
  submitAssessment,
} from "@/lib/assessment/service";

const config = {
  type: "MIXED" as const,
  difficulty: "ADAPTIVE" as const,
  questionCount: 10,
  timeLimitMinutes: 30,
  focus: "MIXED" as const,
};

beforeEach(() => {
  db.running = null;
  db.duplicateWhere = null;
  db.created.length = 0;
  db.answers.length = 0;
  db.deleteWhere.length = 0;
  db.createDelayMs = 0;
  db.goals["user-a"] = "DATA_SCIENTIST";
  db.questions = fresh();
});

describe("assessment sources and ownership", () => {
  it("refuses another user's job match and CV exactly like missing ones", async () => {
    await expect(
      createAssessment("user-a", { source: "JOB_MATCH", jobId: "job-b", ...config }),
    ).rejects.toMatchObject({ code: "JOB_MATCH_NOT_FOUND" });
    await expect(
      createAssessment("user-a", { source: "SKILL", cvId: "cv-b", skills: ["Python"], ...config }),
    ).rejects.toMatchObject({ code: "CV_NOT_FOUND" });
    await expect(
      createAssessment("user-a", {
        source: "SKILL",
        cvId: "cv-a-raw",
        skills: ["Python"],
        ...config,
      }),
    ).rejects.toMatchObject({ code: "CV_NOT_ANALYZED" });
    expect(db.created).toEqual([]);
  });

  it("requires a career goal and a readable job match", async () => {
    db.goals["user-a"] = null;
    await expect(
      createAssessment("user-a", { source: "CAREER_GOAL", cvId: "cv-a", ...config }),
    ).rejects.toMatchObject({ code: "NO_CAREER_GOAL" });
    await expect(
      createAssessment("user-a", { source: "JOB_MATCH", jobId: "job-a", ...config }),
    ).rejects.toMatchObject({ code: "SOURCE_DELETED" });
  });

  it("creates assessments owned by the session user with only supported skills", async () => {
    await createAssessment("user-a", {
      source: "MIXED",
      cvId: "cv-a",
      skills: ["Python", "SQL"],
      ...config,
    });
    expect(db.created[0]).toMatchObject({
      userId: "user-a",
      cvId: "cv-a",
      skills: ["Python", "SQL"],
      sourceType: "MIXED",
    });
    // The fake's duplicate check matches any settings, so clear the "running" one first.
    db.running = null;
    await createAssessment("user-a", { source: "CAREER_GOAL", cvId: "cv-a", ...config });
    expect(db.created[1]).toMatchObject({
      careerGoal: "DATA_SCIENTIST",
      skills: ["Python", "Statistics", "SQL", "Machine Learning", "Data Analysis", "Pandas"],
    });
  });

  it("can't practice again with, start, submit or delete another user's assessment", async () => {
    await expect(practiceAgain("user-a", "as-b")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND",
    });
    await expect(startAssessment("user-a", "as-b")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND",
    });
    await expect(submitAssessment("user-a", "as-b")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND",
    });
    expect(await deleteAssessment("user-a", "as-b")).toBe(false);
    expect(db.deleteWhere).toEqual([{ id: "as-b", userId: "user-a" }]);
  });

  it("practice again creates a new assessment linked to the old one", async () => {
    await practiceAgain("user-a", "as-a");
    expect(db.created[0]).toMatchObject({
      practiceOfId: "as-a",
      skills: ["Python"],
      userId: "user-a",
    });
  });
});

describe("answers: integrity", () => {
  it("refuses another user's question (tampered id) exactly like a missing one", async () => {
    for (const id of ["qb-mc", "missing"]) {
      await expect(saveAnswer("user-a", id, "b")).rejects.toMatchObject({
        code: "QUESTION_NOT_FOUND",
      });
    }
    expect(db.questions.find((q) => q.id === "qb-mc")!.status).toBe("PENDING");
    expect(db.answers).toEqual([]);
  });

  it("grades objective answers on the server and validates options", async () => {
    await expect(saveAnswer("user-a", "qa-mc", "z")).rejects.toMatchObject({
      code: "INVALID_ANSWER",
    });
    await saveAnswer("user-a", "qa-mc", "b");
    expect(db.answers[0]).toMatchObject({
      questionId: "qa-mc",
      isCorrect: true,
      score: 1,
      status: "EVALUATED",
    });
    await saveAnswer("user-a", "qa-open", "A thoughtful answer");
    expect(db.answers[1]).toMatchObject({ questionId: "qa-open", status: "SUBMITTED" });
    expect(db.answers[1]).not.toHaveProperty("score");
  });

  it("locks answers and blocks finished, expired and unstarted assessments", async () => {
    await expect(saveAnswer("user-a", "qa-done", "a")).rejects.toMatchObject({
      code: "ALREADY_ANSWERED",
    });
    await expect(saveAnswer("user-a", "qa-expired", "true")).rejects.toMatchObject({
      code: "EXPIRED",
    });
    await expect(saveAnswer("user-a", "qa-unstarted", "true")).rejects.toMatchObject({
      code: "NOT_STARTED",
    });
    await expect(saveAnswer("user-a", "qa-finished", "true")).rejects.toMatchObject({
      code: "ALREADY_FINISHED",
    });
    expect(db.answers).toEqual([]);
  });

  it("accepts one answer when the same answer is submitted twice at once", async () => {
    const results = await Promise.allSettled([
      saveAnswer("user-a", "qa-mc", "b"),
      saveAnswer("user-a", "qa-mc", "a"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "ALREADY_ANSWERED" },
    });
    expect(db.answers).toHaveLength(1);
  });
});

describe("duplicate generation and rate limits", () => {
  it("joins a running or just-created assessment with the same settings", async () => {
    db.running = { id: "as-running" };
    expect(
      await createAssessment("user-a", {
        source: "SKILL",
        cvId: "cv-a",
        skills: ["Python"],
        ...config,
      }),
    ).toEqual({
      assessmentId: "as-running",
      reused: true,
    });
    const where = db.duplicateWhere as {
      userId: string;
      skills: { equals: string[] };
      OR: [unknown, { status: { not: string }; createdAt: { gte: Date } }];
    };
    expect(where.userId).toBe("user-a");
    expect(where.skills).toEqual({ equals: ["Python"] });
    expect(where.OR[1].status).toEqual({ not: "FAILED" });
    expect(Date.now() - where.OR[1].createdAt.gte.getTime()).toBeLessThan(
      DUPLICATE_WINDOW_MS + 1_000,
    );
    expect(db.created).toEqual([]);
  });

  it("concurrent requests start only one generation", async () => {
    db.createDelayMs = 20;
    const results = await Promise.all([
      createAssessment("user-a", { source: "SKILL", cvId: "cv-a", skills: ["Python"], ...config }),
      createAssessment("user-a", { source: "SKILL", cvId: "cv-a", skills: ["Python"], ...config }),
    ]);
    expect(db.created).toHaveLength(1);
    expect(results[0]!.assessmentId).toBe(results[1]!.assessmentId);
  });

  it("limits generations, answers and submissions per user, separately", async () => {
    const user = `limit-${Date.now()}`;
    for (let i = 0; i < ASSESSMENT_GENERATIONS_PER_HOUR; i++)
      expect((await assessmentGenerationLimiter(user)).ok).toBe(true);
    expect((await assessmentGenerationLimiter(user)).ok).toBe(false);
    for (let i = 0; i < ANSWER_SAVES_PER_HOUR; i++)
      expect((await answerSaveLimiter(user)).ok).toBe(true);
    expect((await answerSaveLimiter(user)).ok).toBe(false);
    for (let i = 0; i < SUBMISSIONS_PER_HOUR; i++)
      expect((await submissionLimiter(user)).ok).toBe(true);
    expect((await submissionLimiter(user)).ok).toBe(false);
    expect((await assessmentGenerationLimiter(`${user}-other`)).ok).toBe(true);
  });
});
