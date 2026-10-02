import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { AIConfigurationError, getAIProvider } from "@/lib/ai/provider";
import {
  generateBio,
  generateHeadline,
  generateSkillSummary,
  improveProjectDescription,
  type Fact,
  type ProjectDraft,
} from "@/lib/ai/portfolio";
import { SUPPORTED_SKILLS, supportedSkill } from "@/lib/assessment/skills";
import { careerGoalLabel } from "@/lib/profile/options";
import { PortfolioError, type PortfolioErrorCode } from "./errors";
import { skillSlug, slugify, uniqueSlug } from "./slug";
import type {
  achievementSchema,
  certificationSchema,
  educationSchema,
  evidenceSchema,
  experienceSchema,
  ItemKind,
  portfolioProfileSchema,
  ProjectData,
  settingsSchema,
  skillSchema,
  skillUpdateSchema,
} from "./validation";
import type { Visibility } from "./constants";

/**
 * Portfolio + Skill Passport writes. Every function takes the owner's id from
 * the session and scopes every query by it — another user's item behaves
 * exactly like a missing one. Logs carry ids and error codes only.
 */

export function errorCodeOf(error: unknown): PortfolioErrorCode {
  if (error instanceof PortfolioError) return error.code;
  if (error instanceof AIConfigurationError) return "AI_UNAVAILABLE";
  return "UNKNOWN";
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/* ─── Profile (headline, bio, location, links) ──────────────────────────────── */

export async function updatePortfolioProfile(
  userId: string,
  data: z.output<typeof portfolioProfileSchema>,
) {
  await prisma.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/* ─── Settings ──────────────────────────────────────────────────────────────── */

export async function updateSettings(userId: string, data: z.output<typeof settingsSchema>) {
  const { username, ...flags } = data;
  if (flags.isPublic && !username) throw new PortfolioError("USERNAME_REQUIRED");
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { username } }),
      prisma.skillPassport.upsert({
        where: { userId },
        create: { userId, ...flags },
        update: flags,
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new PortfolioError("USERNAME_TAKEN");
    throw error;
  }
}

/* ─── Skills ────────────────────────────────────────────────────────────────── */

const CATEGORY_BY_GROUP: Record<
  string,
  "PROGRAMMING" | "DATA" | "AI_ML" | "CLOUD_DEVOPS" | "SECURITY" | "WEB"
> = {
  Programming: "PROGRAMMING",
  Data: "DATA",
  "AI / ML": "AI_ML",
  "Cloud & DevOps": "CLOUD_DEVOPS",
  Web: "WEB",
  Security: "SECURITY",
};

/** The shared Skill row for a name (created once, reused by everyone — no duplicates). */
async function skillRecord(name: string) {
  const canonical = supportedSkill(name) ?? name;
  const slug = skillSlug(canonical);
  const group = SUPPORTED_SKILLS.find((s) => s.name === canonical)?.group;
  try {
    return await prisma.skill.upsert({
      where: { slug },
      create: { name: canonical, slug, category: (group && CATEGORY_BY_GROUP[group]) || "OTHER" },
      update: {},
      select: { id: true, name: true },
    });
  } catch (error) {
    // A concurrent insert or a name differing only by case: reuse the existing row.
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.skill.findFirst({
      where: { OR: [{ slug }, { name: { equals: canonical, mode: "insensitive" } }] },
      select: { id: true, name: true },
    });
    if (!existing) throw error;
    return existing;
  }
}

export async function addSkill(userId: string, data: z.output<typeof skillSchema>) {
  const skill = await skillRecord(data.name);
  try {
    return await prisma.userSkill.create({
      data: {
        userId,
        skillId: skill.id,
        level: data.level,
        visibility: data.visibility,
        source: "SELF_REPORTED",
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new PortfolioError("SKILL_EXISTS");
    throw error;
  }
}

export async function updateSkill(userId: string, data: z.output<typeof skillUpdateSchema>) {
  const updated = await prisma.userSkill.updateMany({
    where: { id: data.id, userId },
    data: { level: data.level, visibility: data.visibility, summary: data.summary },
  });
  if (updated.count === 0) throw new PortfolioError("SKILL_NOT_FOUND");
}

/** Removes the skill from the user's list and from their projects (the shared Skill row stays). */
export async function deleteSkill(userId: string, userSkillId: string) {
  const owned = await prisma.userSkill.findFirst({
    where: { id: userSkillId, userId },
    select: { skillId: true },
  });
  if (!owned) throw new PortfolioError("SKILL_NOT_FOUND");
  const projects = await prisma.project.findMany({
    where: { userId, skills: { some: { id: owned.skillId } } },
    select: { id: true },
  });
  await prisma.$transaction([
    ...projects.map((p) =>
      prisma.project.update({
        where: { id: p.id },
        data: { skills: { disconnect: { id: owned.skillId } } },
      }),
    ),
    prisma.userSkill.deleteMany({ where: { id: userSkillId, userId } }),
  ]);
}

/* ─── Projects ──────────────────────────────────────────────────────────────── */

/** Maps the user's own skill ids (UserSkill) to shared Skill ids; foreign or unknown ids are rejected. */
async function ownedSkillIds(userId: string, userSkillIds: string[]) {
  if (userSkillIds.length === 0) return [];
  const owned = await prisma.userSkill.findMany({
    where: { userId, id: { in: userSkillIds } },
    select: { skillId: true },
  });
  if (owned.length !== new Set(userSkillIds).size) throw new PortfolioError("SKILL_NOT_FOUND");
  return owned.map((o) => ({ id: o.skillId }));
}

async function freeSlug(userId: string, title: string, exceptProjectId?: string) {
  const base = slugify(title);
  const taken = await prisma.project.findMany({
    where: {
      userId,
      slug: { startsWith: base.slice(0, 56) },
      ...(exceptProjectId ? { id: { not: exceptProjectId } } : {}),
    },
    select: { slug: true },
  });
  return uniqueSlug(
    base,
    taken.map((t) => t.slug),
  );
}

export async function createProject(userId: string, data: ProjectData) {
  const { skillIds, ...fields } = data;
  const skills = await ownedSkillIds(userId, skillIds);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.project.create({
        data: {
          ...fields,
          userId,
          slug: await freeSlug(userId, fields.title),
          skills: { connect: skills },
        },
        select: { id: true, slug: true },
      });
    } catch (error) {
      // A concurrent create took the slug: pick the next free one.
      if (!isUniqueViolation(error) || attempt === 2) throw error;
    }
  }
  throw new PortfolioError("DATABASE_ERROR");
}

export async function updateProject(userId: string, projectId: string, data: ProjectData) {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { title: true, slug: true },
  });
  if (!existing) throw new PortfolioError("PROJECT_NOT_FOUND");
  const { skillIds, ...fields } = data;
  const skills = await ownedSkillIds(userId, skillIds);
  const slug =
    existing.title === fields.title
      ? existing.slug
      : await freeSlug(userId, fields.title, projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: { ...fields, slug, skills: { set: skills } },
  });
  return { slug };
}

export async function addEvidence(userId: string, data: z.output<typeof evidenceSchema>) {
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, userId },
    select: { id: true, _count: { select: { evidence: true } } },
  });
  if (!project) throw new PortfolioError("PROJECT_NOT_FOUND");
  if (project._count.evidence >= 10) throw new PortfolioError("INVALID_INPUT");
  await prisma.projectEvidence.create({
    data: { projectId: project.id, kind: data.kind, label: data.label, url: data.url },
  });
}

/* ─── Generic owned items ───────────────────────────────────────────────────── */

type Delegate = {
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

/** Ownership-scoped delegate for each item kind; evidence is owned through its project. */
function owned(
  kind: ItemKind,
  userId: string,
  id: string,
): { delegate: Delegate; where: Record<string, unknown> } {
  switch (kind) {
    case "project":
      return { delegate: prisma.project as unknown as Delegate, where: { id, userId } };
    case "education":
      return { delegate: prisma.education as unknown as Delegate, where: { id, userId } };
    case "certification":
      return { delegate: prisma.certification as unknown as Delegate, where: { id, userId } };
    case "achievement":
      return { delegate: prisma.achievement as unknown as Delegate, where: { id, userId } };
    case "experience":
      return { delegate: prisma.experience as unknown as Delegate, where: { id, userId } };
    case "skill":
      return { delegate: prisma.userSkill as unknown as Delegate, where: { id, userId } };
    case "evidence":
      return {
        delegate: prisma.projectEvidence as unknown as Delegate,
        where: { id, project: { userId } },
      };
  }
}

export async function deleteItem(userId: string, kind: ItemKind, id: string) {
  if (kind === "skill") return deleteSkill(userId, id);
  const { delegate, where } = owned(kind, userId, id);
  const result = await delegate.deleteMany({ where });
  if (result.count === 0)
    throw new PortfolioError(kind === "project" ? "PROJECT_NOT_FOUND" : "NOT_FOUND");
}

export async function setVisibility(
  userId: string,
  kind: ItemKind,
  id: string,
  visibility: Visibility,
) {
  if (kind === "evidence") throw new PortfolioError("NOT_FOUND");
  const { delegate, where } = owned(kind, userId, id);
  const result = await delegate.updateMany({ where, data: { visibility } });
  if (result.count === 0)
    throw new PortfolioError(kind === "project" ? "PROJECT_NOT_FOUND" : "NOT_FOUND");
}

export async function setFeatured(userId: string, projectId: string, featured: boolean) {
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId },
    data: { featured },
  });
  if (result.count === 0) throw new PortfolioError("PROJECT_NOT_FOUND");
}

type SectionData = {
  education: z.output<typeof educationSchema>;
  certification: z.output<typeof certificationSchema>;
  achievement: z.output<typeof achievementSchema>;
  experience: z.output<typeof experienceSchema>;
};

/** Creates (no id) or updates (owned id) an education / certification / achievement / experience entry. */
export async function saveSectionItem<K extends keyof SectionData>(
  userId: string,
  kind: K,
  id: string | null,
  data: SectionData[K],
) {
  const { delegate } = owned(kind, userId, id ?? "");
  if (id) {
    const result = await delegate.updateMany({
      where: { id, userId },
      data: data as Record<string, unknown>,
    });
    if (result.count === 0) throw new PortfolioError("NOT_FOUND");
    return;
  }
  const create = { data: { ...(data as Record<string, unknown>), userId } };
  switch (kind) {
    case "education":
      await prisma.education.create(create as Parameters<typeof prisma.education.create>[0]);
      break;
    case "certification":
      await prisma.certification.create(
        create as Parameters<typeof prisma.certification.create>[0],
      );
      break;
    case "achievement":
      await prisma.achievement.create(create as Parameters<typeof prisma.achievement.create>[0]);
      break;
    case "experience":
      await prisma.experience.create(create as Parameters<typeof prisma.experience.create>[0]);
      break;
  }
}

/* ─── AI assistance ─────────────────────────────────────────────────────────── */

const inflight = new Map<string, Promise<unknown>>();
const recent = new Map<string, { at: number; value: unknown }>();
/** Identical requests within this window share one result (double-click, retry, two tabs). */
export const AI_DUPLICATE_WINDOW_MS = 10_000;

/**
 * Collapses duplicate AI requests: an identical request joins the one in
 * flight, or reuses its result for a few seconds. Only one provider call runs.
 */
export async function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const now = Date.now();
  for (const [k, v] of recent) if (now - v.at > AI_DUPLICATE_WINDOW_MS) recent.delete(k);
  const cached = recent.get(key);
  if (cached) return cached.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const promise = run()
    .then((value) => {
      recent.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Minimal context for the AI: the user's own portfolio facts. No CV text, contact details or answers. */
async function aiContext(userId: string) {
  const [profile, skills, educations, experiences, projects, certifications] = await Promise.all([
    prisma.profile.findUnique({ where: { userId }, select: { careerGoal: true } }),
    prisma.userSkill.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { skill: { select: { name: true } } },
    }),
    prisma.education.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { degree: true, field: true, institution: true },
    }),
    prisma.experience.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { title: true, company: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { title: true, shortDescription: true },
    }),
    prisma.certification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { name: true, issuer: true },
    }),
  ]);
  return {
    goal: profile?.careerGoal ? careerGoalLabel(profile.careerGoal) : null,
    skills: skills.map((s) => s.skill.name),
    educations,
    experiences,
    projects,
    certifications,
  };
}

export async function aiHeadline(userId: string) {
  const ctx = await aiContext(userId);
  const roleOptions = [
    ...ctx.experiences.map((e) => e.title),
    ...ctx.educations.map((e) => [e.degree, e.field].filter(Boolean).join(" in ")).filter(Boolean),
    ...(ctx.goal ? [`Aspiring ${ctx.goal}`] : []),
  ];
  const input = { roleOptions: [...new Set(roleOptions)], skills: ctx.skills };
  return dedupe(`${userId}:headline:${JSON.stringify(input)}`, () =>
    generateHeadline(input, getAIProvider()),
  );
}

export async function aiBio(userId: string) {
  const ctx = await aiContext(userId);
  const facts: Fact[] = [
    ...(ctx.goal ? [{ key: "goal", text: `Career goal: ${ctx.goal}` }] : []),
    ...ctx.educations.map((e, i) => ({
      key: `education:${i}`,
      text: [e.degree, e.field && `in ${e.field}`, `at ${e.institution}`].filter(Boolean).join(" "),
    })),
    ...ctx.experiences.map((e, i) => ({
      key: `experience:${i}`,
      text: `${e.title} at ${e.company}`,
    })),
    ...(ctx.skills.length
      ? [{ key: "skills", text: `Skills: ${ctx.skills.slice(0, 8).join(", ")}` }]
      : []),
    ...ctx.projects.map((p, i) => ({
      key: `project:${i}`,
      text: `${p.title} — ${p.shortDescription}`,
    })),
    ...ctx.certifications.map((c, i) => ({
      key: `certification:${i}`,
      text: `${c.name} from ${c.issuer}`,
    })),
  ];
  return dedupe(`${userId}:bio:${JSON.stringify(facts)}`, () =>
    generateBio({ facts }, getAIProvider()),
  );
}

/** Improves the description from what the user has typed in the form (nothing else). */
export async function aiProject(userId: string, draft: ProjectDraft) {
  return dedupe(`${userId}:project:${JSON.stringify(draft)}`, () =>
    improveProjectDescription(draft, getAIProvider()),
  );
}

export async function aiSkillSummary(userId: string, skill: string, evidence: string[]) {
  return dedupe(`${userId}:skill:${skill}:${JSON.stringify(evidence)}`, () =>
    generateSkillSummary({ skill, evidence }, getAIProvider()),
  );
}
