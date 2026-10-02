import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership rules for CV reads/writes, verified against a fake database with
 * two users' data. The session user is "user-a".
 */
const db = vi.hoisted(() => {
  const cvs = [
    { id: "cv-a", userId: "user-a", storageKey: "cv/usera/1" },
    { id: "cv-b", userId: "user-b", storageKey: "cv/userb/1" },
  ];
  const matches = (cv: (typeof cvs)[number], where: { id?: string; userId?: string }) =>
    (where.id === undefined || cv.id === where.id) &&
    (where.userId === undefined || cv.userId === where.userId);
  return {
    cvs,
    deleted: [] as string[],
    storageDeleted: [] as string[],
    queries: [] as unknown[],
    matches,
  };
});

vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "user-a", email: "a@example.test" }),
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock", MAX_UPLOAD_SIZE_MB: 10 }),
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ delete: async (key: string) => void db.storageDeleted.push(key) }),
  cvStorageKey: () => "cv/x/y",
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cV: {
      findFirst: async ({ where }: { where: { id?: string; userId?: string } }) => {
        db.queries.push(where);
        return db.cvs.find((cv) => db.matches(cv, where)) ?? null;
      },
      delete: async ({ where }: { where: { id: string } }) => void db.deleted.push(where.id),
    },
    cvAnalysis: {
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => null,
      create: async () => ({ id: "analysis-new" }),
    },
  },
}));

import { deleteCv, requestAnalysis } from "@/lib/cv/service";
import { getMyCv } from "@/lib/data/cv";

beforeEach(() => {
  db.deleted.length = 0;
  db.storageDeleted.length = 0;
  db.queries.length = 0;
});

describe("CV ownership", () => {
  it("scopes reads by the session user and hides other users' CVs", async () => {
    expect(await getMyCv("cv-a")).not.toBeNull();
    expect(await getMyCv("cv-b")).toBeNull();
    expect(db.queries).toEqual([
      { id: "cv-a", userId: "user-a" },
      { id: "cv-b", userId: "user-a" },
    ]);
  });

  it("never deletes another user's CV or file", async () => {
    expect(await deleteCv("user-a", "cv-b")).toBe(false);
    expect(db.deleted).toEqual([]);
    expect(db.storageDeleted).toEqual([]);
  });

  it("deletes the owner's CV record and its stored file", async () => {
    expect(await deleteCv("user-a", "cv-a")).toBe(true);
    expect(db.deleted).toEqual(["cv-a"]);
    expect(db.storageDeleted).toEqual(["cv/usera/1"]);
  });

  it("refuses to analyze another user's CV", async () => {
    expect(await requestAnalysis("user-a", "cv-b")).toBeNull();
    expect(await requestAnalysis("user-a", "cv-a")).toEqual({
      analysisId: "analysis-new",
      reused: false,
    });
  });
});
