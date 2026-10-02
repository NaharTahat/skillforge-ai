import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership (IDOR), privacy and abuse rules for the portfolio against a small
 * in-memory database holding two users' data. The session user is "user-a";
 * every request below tries to reach "user-b"'s records.
 */

type Row = Record<string, unknown> & { id: string };

const state = vi.hoisted(() => ({
  session: "user-a",
  tables: {} as Record<string, Row[]>,
  providerCalls: 0,
  uniqueOnUsername: true,
}));

function seed() {
  state.tables = {
    user: [
      {
        id: "user-a",
        email: "a@example.test",
        username: "alice",
        name: "Alice A",
        firstName: "Alice",
        lastName: "A",
        image: null,
        profile: {
          headline: "Data Analyst",
          bio: "Bio A",
          location: "Paris",
          websiteUrl: null,
          githubUrl: null,
          linkedinUrl: null,
        },
        passport: null,
      },
      {
        id: "user-b",
        email: "b-secret@example.test",
        username: "bob",
        name: "Bob B",
        firstName: "Bob",
        lastName: "B",
        image: null,
        profile: {
          headline: "ML Engineer",
          bio: "Bob's public bio",
          location: "Berlin",
          websiteUrl: "https://bob.dev",
          githubUrl: null,
          linkedinUrl: null,
        },
        passport: {
          isPublic: true,
          showAbout: true,
          showProjects: true,
          showSkills: true,
          showEducation: false,
          showCertifications: true,
          showAchievements: true,
          showExperience: true,
          showLinks: true,
          showAssessments: true,
          showInterviewScore: false,
        },
      },
    ],
    project: [
      {
        id: "proja",
        userId: "user-a",
        title: "A project",
        slug: "a-project",
        shortDescription: "s",
        visibility: "PRIVATE",
        status: "COMPLETED",
        featured: false,
        technologies: [],
        skills: [],
        evidence: [],
        repositoryUrl: null,
        liveUrl: null,
      },
      {
        id: "projbpublic",
        userId: "user-b",
        title: "Bob Public Project",
        slug: "bob-public",
        shortDescription: "public one",
        visibility: "PUBLIC",
        status: "COMPLETED",
        featured: true,
        technologies: ["Python"],
        skills: [{ id: "skill-python", name: "Python" }],
        evidence: [{ kind: "REPOSITORY", label: null, url: "https://github.com/bob/x" }],
        repositoryUrl: null,
        liveUrl: null,
        description: null,
        role: null,
        startDate: null,
        endDate: null,
      },
      {
        id: "projbprivate",
        userId: "user-b",
        title: "Bob SECRET Project",
        slug: "bob-secret",
        shortDescription: "private one",
        visibility: "PRIVATE",
        status: "COMPLETED",
        featured: false,
        technologies: [],
        skills: [],
        evidence: [],
        repositoryUrl: null,
        liveUrl: null,
      },
    ],
    projectEvidence: [
      { id: "eva", project: { userId: "user-a" }, projectId: "proja", url: "https://a.dev" },
      { id: "evb", project: { userId: "user-b" }, projectId: "projbpublic", url: "https://b.dev" },
    ],
    userSkill: [
      {
        id: "usa",
        userId: "user-a",
        skillId: "skill-python",
        level: "BEGINNER",
        visibility: "PRIVATE",
        summary: null,
        position: 0,
        skill: { name: "Python", id: "skill-python" },
      },
      {
        id: "usb",
        userId: "user-b",
        skillId: "skill-python",
        level: "ADVANCED",
        visibility: "PUBLIC",
        summary: null,
        position: 0,
        skill: { name: "Python", id: "skill-python" },
      },
      {
        id: "usbprivate",
        userId: "user-b",
        skillId: "skill-secret",
        level: "BEGINNER",
        visibility: "PRIVATE",
        summary: null,
        position: 1,
        skill: { name: "SecretSkill", id: "skill-secret" },
      },
    ],
    skill: [{ id: "skill-python", name: "Python", slug: "python" }],
    education: [
      {
        id: "edub",
        userId: "user-b",
        institution: "Bob University",
        visibility: "PUBLIC",
        position: 0,
      },
    ],
    certification: [
      {
        id: "certa",
        userId: "user-a",
        name: "Cert A",
        issuer: "X",
        skills: [],
        visibility: "PRIVATE",
      },
      {
        id: "certb",
        userId: "user-b",
        name: "Bob Public Cert",
        issuer: "Y",
        skills: ["Python"],
        visibility: "PUBLIC",
      },
      {
        id: "certbprivate",
        userId: "user-b",
        name: "Bob PRIVATE Cert",
        issuer: "Z",
        skills: [],
        visibility: "PRIVATE",
      },
    ],
    achievement: [
      {
        id: "achb",
        userId: "user-b",
        title: "Bob Achievement",
        kind: "AWARD",
        visibility: "PRIVATE",
      },
    ],
    experience: [
      { id: "expb", userId: "user-b", company: "Bob Co", title: "Engineer", visibility: "PUBLIC" },
    ],
    skillPassport: [],
    profile: [],
    assessmentResult: [
      {
        id: "res-b",
        assessment: { userId: "user-b", status: "COMPLETED" },
        skillBreakdown: [
          {
            skill: "Python",
            score: 9.2,
            max: 10,
            percentage: 92,
            level: "DEVELOPING",
            questions: 10,
          },
        ],
        createdAt: new Date("2026-01-01"),
      },
    ],
    interviewQuestion: [
      {
        id: "iq-b",
        interview: { userId: "user-b", status: "COMPLETED" },
        skill: "Python",
        answer: { status: "EVALUATED", score: 90, text: "PRIVATE ANSWER TEXT" },
      },
    ],
  };
}

/* ─── A tiny where/select interpreter, enough for the portfolio queries ─────── */

function matches(value: unknown, cond: unknown): boolean {
  if (cond === undefined) return true;
  if (cond === null || typeof cond !== "object" || cond instanceof Date) return value === cond;
  const c = cond as Record<string, unknown>;
  if ("in" in c) return (c.in as unknown[]).includes(value);
  if ("not" in c) return value !== c.not;
  if ("startsWith" in c)
    return typeof value === "string" && value.startsWith(c.startsWith as string);
  if ("equals" in c)
    return typeof value === "string" && value.toLowerCase() === String(c.equals).toLowerCase();
  if ("some" in c) return true;
  if (value === null || value === undefined) return false;
  return Object.entries(c).every(([k, v]) => matches((value as Record<string, unknown>)[k], v));
}
function whereMatch(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => whereMatch(row, w));
    return matches(row[k], v);
  });
}
function project(row: unknown, select?: Record<string, unknown>): unknown {
  if (!select || row === null || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map((r) => project(r, select));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(select)) {
    const value = (row as Record<string, unknown>)[k];
    if (k === "_count") out[k] = { evidence: 0 };
    else if (v === true) out[k] = value;
    else if (v && typeof v === "object")
      out[k] = project(value ?? null, (v as { select?: Record<string, unknown> }).select);
  }
  return out;
}

class UniqueError extends Error {
  code = "P2002";
}

function delegate(name: string) {
  const rows = () => (state.tables[name] ??= []);
  return {
    findFirst: async (
      a: { where?: Record<string, unknown>; select?: Record<string, unknown> } = {},
    ) => {
      const r = rows().find((x) => whereMatch(x, a.where));
      return r ? project(r, a.select) : null;
    },
    findUnique: async (
      a: { where?: Record<string, unknown>; select?: Record<string, unknown> } = {},
    ) => {
      const r = rows().find((x) => whereMatch(x, a.where));
      return r ? project(r, a.select) : null;
    },
    findUniqueOrThrow: async (a: {
      where?: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) => {
      const r = rows().find((x) => whereMatch(x, a.where));
      if (!r) throw new Error("not found");
      return project(r, a.select);
    },
    findMany: async (
      a: { where?: Record<string, unknown>; select?: Record<string, unknown>; take?: number } = {},
    ) =>
      rows()
        .filter((x) => whereMatch(x, a.where))
        .slice(0, a.take ?? Infinity)
        .map((r) => project(r, a.select)),
    count: async (a: { where?: Record<string, unknown> } = {}) =>
      rows().filter((x) => whereMatch(x, a.where)).length,
    create: async (a: { data: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const data = { ...a.data };
      delete data.skills; // relation writes are not modelled
      const row = { id: `${name}-${rows().length + 1}`, ...data } as Row;
      rows().push(row);
      return project(row, a.select);
    },
    update: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const r = rows().find((x) => whereMatch(x, a.where));
      if (!r) throw new Error("not found");
      if (
        name === "user" &&
        state.uniqueOnUsername &&
        a.data.username &&
        rows().some((u) => u.id !== r.id && u.username === a.data.username)
      ) {
        throw new UniqueError("unique");
      }
      const data = { ...a.data };
      delete data.skills; // relation writes are not modelled
      Object.assign(r, data);
      return r;
    },
    upsert: async (a: {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      select?: Record<string, unknown>;
    }) => {
      const r = rows().find((x) => whereMatch(x, a.where));
      if (r) Object.assign(r, a.update);
      else rows().push({ id: `${name}-${rows().length + 1}`, ...a.create } as Row);
      return project(r ?? rows().at(-1), a.select);
    },
    updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows().filter((x) => whereMatch(x, a.where));
      for (const r of hit) Object.assign(r, a.data);
      return { count: hit.length };
    },
    deleteMany: async (a: { where: Record<string, unknown> }) => {
      const before = rows().length;
      state.tables[name] = rows().filter((x) => !whereMatch(x, a.where));
      return { count: before - state.tables[name]!.length };
    },
  };
}

vi.mock("@/lib/db/prisma", () => {
  const names = [
    "user",
    "project",
    "projectEvidence",
    "userSkill",
    "skill",
    "education",
    "certification",
    "achievement",
    "experience",
    "skillPassport",
    "profile",
    "assessmentResult",
    "interviewQuestion",
    "assessment",
    "cvAnalysis",
    "jobAnalysis",
    "roadmapItem",
  ];
  const prisma: Record<string, unknown> = Object.fromEntries(names.map((n) => [n, delegate(n)]));
  prisma.$transaction = async (ops: Promise<unknown>[]) => Promise.all(ops);
  return { prisma };
});
vi.mock("@/lib/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: UniqueErrorProxy() },
}));
function UniqueErrorProxy() {
  // `instanceof` checks in the service compare against this class.
  return class {
    static [Symbol.hasInstance](v: unknown) {
      return typeof v === "object" && v !== null && (v as { code?: string }).code === "P2002";
    }
  };
}
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: state.session, email: "a@example.test" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock", NODE_ENV: "test" }),
}));
vi.mock("@/lib/ai/provider", async () => {
  const { MockAIProvider } = await import("@/lib/ai/providers/mock");
  const inner = new MockAIProvider(0);
  return {
    AIConfigurationError: class extends Error {},
    getAIProvider: () => ({
      name: "counting-mock",
      generateStructured: async (req: Parameters<typeof inner.generateStructured>[0]) => {
        state.providerCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return inner.generateStructured(req);
      },
    }),
  };
});

const actions = await import("@/app/dashboard/portfolio/actions");
const { getPublicPortfolio, getPublicProject } = await import("@/lib/data/public-portfolio");

const NOT_FOUND = "This item doesn't exist or you don't have access to it.";
const PROJECT_NOT_FOUND = "This project doesn't exist or you don't have access to it.";

const projectInput = {
  title: "Hijack",
  shortDescription: "x",
  description: "",
  role: "",
  technologies: [],
  skillIds: [],
  repositoryUrl: "",
  liveUrl: "",
  imageUrl: "",
  startDate: "",
  endDate: "",
  status: "COMPLETED",
  featured: false,
  visibility: "PUBLIC",
};

beforeEach(() => {
  seed();
  state.session = "user-a";
  state.providerCalls = 0;
});

const row = (table: string, id: string) => state.tables[table]!.find((r) => r.id === id);

describe("IDOR: another user's records behave like missing ones", () => {
  it("cannot edit another user's project (tampered project id)", async () => {
    const r = await actions.saveProjectAction({ id: "projbprivate", project: projectInput });
    expect(r).toEqual({ ok: false, error: PROJECT_NOT_FOUND });
    expect(row("project", "projbprivate")!.title).toBe("Bob SECRET Project");
  });

  it("cannot delete, publish or feature another user's project", async () => {
    expect(await actions.deleteItemAction({ kind: "project", id: "projbprivate" })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.setVisibilityAction({
        kind: "project",
        id: "projbprivate",
        visibility: "PUBLIC",
      }),
    ).toMatchObject({ ok: false });
    expect(await actions.setFeaturedAction({ id: "projbprivate", featured: true })).toMatchObject({
      ok: false,
    });
    expect(row("project", "projbprivate")).toMatchObject({
      visibility: "PRIVATE",
      featured: false,
    });
  });

  it("cannot link another user's skill to a project", async () => {
    const r = await actions.saveProjectAction({
      id: null,
      project: { ...projectInput, skillIds: ["usb"] },
    });
    expect(r).toEqual({ ok: false, error: "That skill isn't in your skill list." });
  });

  it("ignores a browser-supplied userId when creating", async () => {
    const r = await actions.saveProjectAction({
      id: null,
      project: { ...projectInput, userId: "user-b" },
      userId: "user-b",
    });
    expect(r.ok).toBe(true);
    const created = state.tables.project!.at(-1)!;
    expect(created.userId).toBe("user-a");
  });

  it("cannot add or delete evidence on another user's project", async () => {
    expect(
      await actions.addEvidenceAction({
        projectId: "projbpublic",
        kind: "REPOSITORY",
        label: "",
        url: "https://x.dev",
      }),
    ).toMatchObject({ ok: false });
    expect(await actions.deleteItemAction({ kind: "evidence", id: "evb" })).toEqual({
      ok: false,
      error: NOT_FOUND,
    });
    expect(row("projectEvidence", "evb")).toBeDefined();
    expect(await actions.deleteItemAction({ kind: "evidence", id: "eva" })).toEqual({ ok: true });
  });

  it("cannot touch another user's skills, certifications, education, achievements or experience", async () => {
    expect(
      await actions.updateSkillAction({
        id: "usb",
        level: "BEGINNER",
        visibility: "PRIVATE",
        summary: "",
      }),
    ).toMatchObject({ ok: false });
    expect(row("userSkill", "usb")!.level).toBe("ADVANCED");
    expect(await actions.deleteItemAction({ kind: "skill", id: "usb" })).toMatchObject({
      ok: false,
    });
    for (const [kind, id, table] of [
      ["certification", "certb", "certification"],
      ["education", "edub", "education"],
      ["achievement", "achb", "achievement"],
      ["experience", "expb", "experience"],
    ] as const) {
      expect(await actions.deleteItemAction({ kind, id })).toEqual({ ok: false, error: NOT_FOUND });
      expect(await actions.setVisibilityAction({ kind, id, visibility: "PRIVATE" })).toEqual({
        ok: false,
        error: NOT_FOUND,
      });
      expect(row(table, id)).toBeDefined();
    }
    const cert = {
      name: "Hijacked",
      issuer: "X",
      issueDate: "",
      expirationDate: "",
      credentialId: "",
      credentialUrl: "",
      description: "",
      skills: [],
      visibility: "PUBLIC",
    };
    expect(
      await actions.saveSectionAction({ kind: "certification", id: "certb", data: cert }),
    ).toEqual({ ok: false, error: NOT_FOUND });
    expect(row("certification", "certb")!.name).toBe("Bob Public Cert");
  });

  it("rejects malformed ids and unknown kinds", async () => {
    expect(await actions.deleteItemAction({ kind: "user", id: "user-b" })).toMatchObject({
      ok: false,
    });
    expect(await actions.deleteItemAction({ kind: "project", id: "x' OR 1=1 --" })).toMatchObject({
      ok: false,
    });
    expect(
      await actions.saveProjectAction({ id: "../../etc", project: projectInput }),
    ).toMatchObject({ ok: false });
  });

  it("can still manage its own items", async () => {
    expect(
      await actions.setVisibilityAction({ kind: "project", id: "proja", visibility: "PUBLIC" }),
    ).toEqual({ ok: true });
    expect(row("project", "proja")!.visibility).toBe("PUBLIC");
    expect(await actions.deleteItemAction({ kind: "certification", id: "certa" })).toEqual({
      ok: true,
    });
  });
});

describe("settings", () => {
  const flags = {
    showAbout: true,
    showProjects: true,
    showSkills: true,
    showEducation: true,
    showCertifications: true,
    showAchievements: true,
    showExperience: true,
    showLinks: true,
    showAssessments: true,
    showInterviewScore: false,
  };

  it("rejects a username that's taken", async () => {
    const r = await actions.updateSettingsAction({ ...flags, username: "bob", isPublic: true });
    expect(r).toEqual({ ok: false, error: "That username is already taken. Try another one." });
  });

  it("requires a username to go public", async () => {
    const r = await actions.updateSettingsAction({ ...flags, username: "", isPublic: true });
    expect(r).toEqual({
      ok: false,
      error: "Choose a username before making your portfolio public.",
    });
  });

  it("rejects reserved usernames", async () => {
    const r = await actions.updateSettingsAction({
      ...flags,
      username: "dashboard",
      isPublic: false,
    });
    expect(r).toMatchObject({ ok: false, fieldErrors: { username: "That username is reserved" } });
  });
});

describe("public portfolio isolation", () => {
  it("returns nothing for private portfolios, unknown or invalid usernames", async () => {
    expect(await getPublicPortfolio("alice")).toBeNull(); // no passport → private
    expect(await getPublicPortfolio("nobody")).toBeNull();
    expect(await getPublicPortfolio("../admin")).toBeNull();
    row("user", "user-b")!.passport = {
      ...(row("user", "user-b")!.passport as object),
      isPublic: false,
    };
    expect(await getPublicPortfolio("bob")).toBeNull();
  });

  it("shows only public items in enabled sections and never private data", async () => {
    const data = await getPublicPortfolio("bob");
    expect(data).not.toBeNull();
    const json = JSON.stringify(data);
    expect(data!.projects.map((p) => p.title)).toEqual(["Bob Public Project"]);
    expect(data!.certifications.map((c) => c.name)).toEqual(["Bob Public Cert"]);
    expect(data!.skills.map((s) => s.name)).toEqual(["Python"]);
    expect(data!.educations).toEqual([]); // section turned off
    expect(data!.achievements).toEqual([]); // item is private
    expect(json).not.toMatch(/SECRET|PRIVATE Cert|SecretSkill|b-secret@|email|PRIVATE ANSWER TEXT/);
    // No internal ids: no "id" keys and no database ids anywhere.
    expect(json).not.toMatch(/"id"|user-b|projb|usb|certb|skill-python/);
  });

  it("uses only allowed evidence publicly (no interview data unless enabled)", async () => {
    const skill = (await getPublicPortfolio("bob"))!.skills[0]!;
    expect(skill.assessment?.percentage).toBe(92);
    expect(skill.interviewAnswers).toBe(0);
    expect(skill.projects).toEqual([{ title: "Bob Public Project", slug: "bob-public" }]);
    const p = row("user", "user-b")!.passport as Record<string, boolean>;
    p.showAssessments = false;
    expect((await getPublicPortfolio("bob"))!.skills[0]!.assessment).toBeNull();
  });

  it("hides private projects and every project when the section is off", async () => {
    expect(await getPublicProject("bob", "bob-secret")).toBeNull();
    expect((await getPublicProject("bob", "bob-public"))!.project.title).toBe("Bob Public Project");
    expect(JSON.stringify(await getPublicProject("bob", "bob-public"))).not.toMatch(/"id"|user-b/);
    (row("user", "user-b")!.passport as Record<string, boolean>).showProjects = false;
    expect(await getPublicProject("bob", "bob-public")).toBeNull();
    expect(await getPublicProject("bob", "<script>")).toBeNull();
  });
});

describe("AI abuse protection", () => {
  it("collapses duplicate concurrent generations into one provider call", async () => {
    state.session = "user-dup";
    state.tables.userSkill!.push({
      id: "usdup",
      userId: "user-dup",
      skillId: "skill-python",
      position: 0,
      skill: { name: "Python" },
    });
    const [a, b] = await Promise.all([actions.aiHeadlineAction(), actions.aiHeadlineAction()]);
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
    expect(state.providerCalls).toBe(1);
    // A repeat within the duplicate window reuses the result.
    await actions.aiHeadlineAction();
    expect(state.providerCalls).toBe(1);
  });

  it("limits AI generations to 10 per user per hour", async () => {
    state.session = "user-rl";
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await actions.aiBioAction());
    expect(results.slice(0, 10).every((r) => !r.ok && !/Too many/i.test(r.error))).toBe(true);
    const last = results[10]!;
    expect(last.ok).toBe(false);
    expect(!last.ok && last.error).toMatch(/minute/);
    // Another user is unaffected.
    state.session = "user-other";
    expect((await actions.aiBioAction()).ok).toBe(false); // nothing to generate, but not rate limited
  });

  it("refuses to generate from nothing rather than inventing", async () => {
    state.session = "user-empty";
    expect(await actions.aiHeadlineAction()).toEqual({
      ok: false,
      error: expect.stringContaining("only uses what you've provided"),
    });
  });
});
