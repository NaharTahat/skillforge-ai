import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership and duplicate-request rules for Job Match, against a fake database
 * holding two users' data. The session user is "user-a".
 */
const db = vi.hoisted(() => ({
  cvs: [
    { id: "cv-a", userId: "user-a", analyzed: true },
    { id: "cv-a-new", userId: "user-a", analyzed: false },
    { id: "cv-b", userId: "user-b", analyzed: true },
  ],
  jobs: [
    { id: "job-a", userId: "user-a", latestCvId: "cv-a" },
    { id: "job-b", userId: "user-b", latestCvId: "cv-b" },
  ],
  running: null as null | { id: string; jobId: string },
  created: [] as string[],
  deleteWhere: [] as unknown[],
}));

vi.mock("@/lib/env", () => ({ getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock" }) }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cV: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const cv = db.cvs.find((c) => c.id === where.id && c.userId === where.userId);
        return cv ? { id: cv.id, analyses: cv.analyzed ? [{ id: "an" }] : [] } : null;
      },
    },
    job: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const job = db.jobs.find((j) => j.id === where.id && j.userId === where.userId);
        return job ? { id: job.id, analyses: [{ cvId: job.latestCvId }] } : null;
      },
      create: async () => {
        db.created.push("job");
        return { id: "job-new", analyses: [{ id: "run-new" }] };
      },
      deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
        db.deleteWhere.push(where);
        return {
          count: db.jobs.filter((j) => j.id === where.id && j.userId === where.userId).length,
        };
      },
    },
    jobAnalysis: {
      findFirst: async () => db.running,
      updateMany: async () => ({ count: 0 }),
      create: async () => {
        db.created.push("run");
        return { id: "run-new" };
      },
    },
  },
}));

import { jobMatchLimiter, JOB_MATCH_LIMIT_PER_HOUR } from "@/lib/job-match/rate-limits";
import { createJobMatch, deleteJobMatch, requestJobReanalysis } from "@/lib/job-match/service";

const input = {
  cvId: "cv-a",
  jobTitle: null,
  company: null,
  location: null,
  jobUrl: null,
  jobDescription: "d".repeat(200),
};

beforeEach(() => {
  db.running = null;
  db.created.length = 0;
  db.deleteWhere.length = 0;
});

describe("Job Match ownership", () => {
  it("refuses another user's CV exactly like a missing one", async () => {
    await expect(createJobMatch("user-a", { ...input, cvId: "cv-b" })).rejects.toMatchObject({
      code: "CV_NOT_FOUND",
    });
    await expect(createJobMatch("user-a", { ...input, cvId: "nope" })).rejects.toMatchObject({
      code: "CV_NOT_FOUND",
    });
    expect(db.created).toEqual([]);
  });

  it("requires the CV to have a completed analysis", async () => {
    await expect(createJobMatch("user-a", { ...input, cvId: "cv-a-new" })).rejects.toMatchObject({
      code: "CV_NOT_ANALYZED",
    });
  });

  it("creates a match for the user's own analyzed CV", async () => {
    expect(await createJobMatch("user-a", input)).toEqual({
      jobId: "job-new",
      analysisId: "run-new",
      reused: false,
    });
  });

  it("refuses to re-run another user's match", async () => {
    await expect(requestJobReanalysis("user-a", "job-b")).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
    });
  });

  it("scopes deletes by the session user", async () => {
    expect(await deleteJobMatch("user-a", "job-b")).toBe(false);
    expect(await deleteJobMatch("user-a", "job-a")).toBe(true);
    expect(db.deleteWhere).toEqual([
      { id: "job-b", userId: "user-a" },
      { id: "job-a", userId: "user-a" },
    ]);
  });
});

describe("duplicate requests", () => {
  it("reuses an identical submission that is still running", async () => {
    db.running = { id: "run-running", jobId: "job-a" };
    expect(await createJobMatch("user-a", input)).toEqual({
      jobId: "job-a",
      analysisId: "run-running",
      reused: true,
    });
    expect(db.created).toEqual([]);
  });

  it("reuses the running analysis instead of starting a second re-run", async () => {
    db.running = { id: "run-running", jobId: "job-a" };
    expect(await requestJobReanalysis("user-a", "job-a")).toEqual({
      analysisId: "run-running",
      reused: true,
    });
    expect(db.created).toEqual([]);
  });
});

describe("Job Match rate limit", () => {
  it(`allows ${JOB_MATCH_LIMIT_PER_HOUR} runs per user per hour`, async () => {
    const now = 1_000_000;
    for (let i = 0; i < JOB_MATCH_LIMIT_PER_HOUR; i++) {
      expect((await jobMatchLimiter("rate-user", now)).ok).toBe(true);
    }
    expect((await jobMatchLimiter("rate-user", now)).ok).toBe(false);
    expect((await jobMatchLimiter("other-user", now)).ok).toBe(true);
  });
});
