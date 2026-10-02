import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership, source and duplicate-generation rules for roadmaps against a fake
 * database holding two users' data. The session user is "user-a".
 */
const db = vi.hoisted(() => ({
  cvs: [
    { id: "cv-a", userId: "user-a", analyzed: true },
    { id: "cv-a-new", userId: "user-a", analyzed: false },
    { id: "cv-b", userId: "user-b", analyzed: true },
  ],
  jobs: [
    { id: "job-a", userId: "user-a", run: { id: "run-a", cvId: "cv-a" as string | null } },
    { id: "job-a-pending", userId: "user-a", run: null },
    { id: "job-a-cv-gone", userId: "user-a", run: { id: "run-x", cvId: null } },
    { id: "job-b", userId: "user-b", run: { id: "run-b", cvId: "cv-b" } },
  ],
  profiles: { "user-a": { careerGoal: "AI_ENGINEER" as string | null } } as Record<
    string,
    { careerGoal: string | null }
  >,
  roadmaps: [
    { id: "rm-a", userId: "user-a", sourceType: "JOB_MATCH", jobId: "job-a", cvId: "cv-a" },
    { id: "rm-b", userId: "user-b", sourceType: "JOB_MATCH", jobId: "job-b", cvId: "cv-b" },
  ],
  items: [
    {
      id: "task-a",
      roadmapId: "rm-a",
      userId: "user-a",
      status: "AVAILABLE",
      key: "t1",
      dependsOn: [] as string[],
    },
    {
      id: "task-a-locked",
      roadmapId: "rm-a",
      userId: "user-a",
      status: "LOCKED",
      key: "t2",
      dependsOn: ["t1"],
    },
    {
      id: "task-b",
      roadmapId: "rm-b",
      userId: "user-b",
      status: "AVAILABLE",
      key: "t1",
      dependsOn: [],
    },
  ],
  running: null as null | { id: string },
  created: [] as unknown[],
  updated: [] as string[],
  deleteWhere: [] as unknown[],
  createDelayMs: 0,
}));

type Where = Record<string, unknown> & { id?: string; userId?: string };

vi.mock("@/lib/env", () => ({ getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock" }) }));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
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
          ? { id: job.id, title: "ML Engineer", company: null, analyses: job.run ? [job.run] : [] }
          : null;
      },
    },
    profile: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        db.profiles[where.userId] ?? null,
    },
    roadmap: {
      findFirst: async ({ where }: { where: Where }) => {
        if (where.status) return db.running;
        const roadmap = db.roadmaps.find((r) => r.id === where.id && r.userId === where.userId);
        return roadmap
          ? {
              ...roadmap,
              title: "Roadmap",
              goal: "ML Engineer",
              careerGoal: null,
              timeframeWeeks: null,
            }
          : null;
      },
      create: async ({ data }: { data: unknown }) => {
        if (db.createDelayMs) await new Promise((r) => setTimeout(r, db.createDelayMs));
        db.created.push(data);
        const id = `rm-new-${db.created.length}`;
        // A created roadmap is "running" until generation finishes.
        db.running = { id };
        return { id };
      },
      updateMany: async () => ({ count: 0 }),
      deleteMany: async ({ where }: { where: Where }) => {
        db.deleteWhere.push(where);
        return {
          count: db.roadmaps.filter((r) => r.id === where.id && r.userId === where.userId).length,
        };
      },
    },
    roadmapItem: {
      findFirst: async ({ where }: { where: { id: string; roadmap: { userId: string } } }) => {
        const item = db.items.find((i) => i.id === where.id && i.userId === where.roadmap.userId);
        return item
          ? { roadmapId: item.roadmapId, status: item.status, roadmap: { status: "COMPLETED" } }
          : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        db.updated.push(where.id);
        const item = db.items.find((i) => i.id === where.id)!;
        item.status = data.status;
        return item;
      },
      findMany: async ({ where }: { where: { roadmapId: string } }) =>
        db.items.filter((i) => i.roadmapId === where.roadmapId),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import { roadmapLimiter, ROADMAP_LIMIT_PER_HOUR } from "@/lib/roadmap/rate-limits";
import {
  createRoadmap,
  deleteRoadmap,
  regenerateRoadmap,
  updateTaskStatus,
} from "@/lib/roadmap/service";

beforeEach(() => {
  db.running = null;
  db.created.length = 0;
  db.updated.length = 0;
  db.deleteWhere.length = 0;
  db.createDelayMs = 0;
  db.profiles["user-a"] = { careerGoal: "AI_ENGINEER" };
  for (const item of db.items) item.status = item.id === "task-a-locked" ? "LOCKED" : "AVAILABLE";
});

describe("roadmap sources and ownership", () => {
  it("refuses another user's job match exactly like a missing one", async () => {
    for (const jobId of ["job-b", "missing"]) {
      await expect(createRoadmap("user-a", { source: "JOB_MATCH", jobId })).rejects.toMatchObject({
        code: "JOB_MATCH_NOT_FOUND",
      });
    }
    expect(db.created).toEqual([]);
  });

  it("requires a completed job match whose CV still exists", async () => {
    await expect(
      createRoadmap("user-a", { source: "JOB_MATCH", jobId: "job-a-pending" }),
    ).rejects.toMatchObject({ code: "JOB_MATCH_NOT_READY" });
    await expect(
      createRoadmap("user-a", { source: "JOB_MATCH", jobId: "job-a-cv-gone" }),
    ).rejects.toMatchObject({ code: "SOURCE_DELETED" });
  });

  it("refuses another user's CV and unanalyzed CVs for career-goal roadmaps", async () => {
    const input = { source: "CAREER_GOAL" as const, timeframeWeeks: null };
    await expect(createRoadmap("user-a", { ...input, cvId: "cv-b" })).rejects.toMatchObject({
      code: "CV_NOT_FOUND",
    });
    await expect(createRoadmap("user-a", { ...input, cvId: "cv-a-new" })).rejects.toMatchObject({
      code: "CV_NOT_ANALYZED",
    });
    expect(db.created).toEqual([]);
  });

  it("requires a career goal in the profile", async () => {
    db.profiles["user-a"] = { careerGoal: null };
    await expect(
      createRoadmap("user-a", { source: "CAREER_GOAL", cvId: "cv-a", timeframeWeeks: null }),
    ).rejects.toMatchObject({ code: "NO_CAREER_GOAL" });
  });

  it("creates roadmaps owned by the session user only", async () => {
    await createRoadmap("user-a", { source: "JOB_MATCH", jobId: "job-a" });
    expect(db.created[0]).toMatchObject({ userId: "user-a", jobId: "job-a", cvId: "cv-a" });
  });

  it("can't re-generate or delete another user's roadmap", async () => {
    await expect(regenerateRoadmap("user-a", "rm-b")).rejects.toMatchObject({
      code: "ROADMAP_NOT_FOUND",
    });
    expect(await deleteRoadmap("user-a", "rm-b")).toBe(false);
    expect(db.deleteWhere).toEqual([{ id: "rm-b", userId: "user-a" }]);
  });

  it("re-generation creates a new roadmap linked to the old one", async () => {
    const result = await regenerateRoadmap("user-a", "rm-a");
    expect(result.reused).toBe(false);
    expect(db.created[0]).toMatchObject({ regeneratedFromId: "rm-a", jobId: "job-a" });
  });
});

describe("roadmap task ownership", () => {
  it("refuses another user's task exactly like a missing one", async () => {
    for (const taskId of ["task-b", "missing"]) {
      await expect(updateTaskStatus("user-a", taskId, "COMPLETED")).rejects.toMatchObject({
        code: "TASK_NOT_FOUND",
      });
    }
    expect(db.updated).toEqual([]);
    expect(db.items.find((i) => i.id === "task-b")!.status).toBe("AVAILABLE");
  });

  it("refuses to change a locked task", async () => {
    await expect(updateTaskStatus("user-a", "task-a-locked", "COMPLETED")).rejects.toMatchObject({
      code: "TASK_LOCKED",
    });
  });

  it("completing a prerequisite unlocks its dependents and updates progress", async () => {
    const progress = await updateTaskStatus("user-a", "task-a", "COMPLETED");
    expect(db.items.find((i) => i.id === "task-a-locked")!.status).toBe("AVAILABLE");
    expect(progress).toMatchObject({ total: 2, completed: 1, percent: 50 });
  });
});

describe("duplicate generation", () => {
  it("reuses a running roadmap for the same source", async () => {
    db.running = { id: "rm-running" };
    const result = await createRoadmap("user-a", { source: "JOB_MATCH", jobId: "job-a" });
    expect(result).toEqual({ roadmapId: "rm-running", reused: true });
    expect(db.created).toEqual([]);
  });

  it("concurrent requests start only one generation", async () => {
    db.createDelayMs = 20;
    const results = await Promise.all([
      createRoadmap("user-a", { source: "JOB_MATCH", jobId: "job-a" }),
      createRoadmap("user-a", { source: "JOB_MATCH", jobId: "job-a" }),
    ]);
    expect(db.created).toHaveLength(1);
    expect(results.map((r) => r.reused).sort()).toEqual([false, true]);
    expect(results[0]!.roadmapId).toBe(results[1]!.roadmapId);
  });
});

describe("roadmap rate limit", () => {
  it("allows 10 generations per user per hour", async () => {
    const user = `limit-${Date.now()}`;
    for (let i = 0; i < ROADMAP_LIMIT_PER_HOUR; i++)
      expect((await roadmapLimiter(user)).ok).toBe(true);
    expect((await roadmapLimiter(user)).ok).toBe(false);
    expect((await roadmapLimiter(`${user}-other`)).ok).toBe(true);
  });
});
