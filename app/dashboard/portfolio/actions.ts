"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validationFailure, type ActionResult } from "@/lib/actions/result";
import { requireUser } from "@/lib/auth/session";
import { getMySkill } from "@/lib/data/portfolio";
import { PortfolioError, portfolioErrorMessage } from "@/lib/portfolio/errors";
import { portfolioAiLimiter } from "@/lib/portfolio/rate-limits";
import {
  addEvidence,
  addSkill,
  aiBio,
  aiHeadline,
  aiProject,
  aiSkillSummary,
  createProject,
  deleteItem,
  errorCodeOf,
  saveSectionItem,
  setFeatured,
  setVisibility,
  updatePortfolioProfile,
  updateProject,
  updateSettings,
  updateSkill,
} from "@/lib/portfolio/service";
import {
  achievementSchema,
  certificationSchema,
  educationSchema,
  evidenceSchema,
  experienceSchema,
  idSchema,
  itemRefSchema,
  portfolioProfileSchema,
  projectSchema,
  settingsSchema,
  skillSchema,
  skillUpdateSchema,
  visibilityToggleSchema,
} from "@/lib/portfolio/validation";

/**
 * Portfolio server actions. The user always comes from the session; any
 * userId in the request is ignored. Errors become safe, friendly messages.
 */

type Fail = { ok: false; error: string; fieldErrors?: Record<string, string> };

function failure(error: unknown): Fail {
  if (error instanceof PortfolioError)
    return { ok: false, error: portfolioErrorMessage(error.code) };
  console.error(`[portfolio] action failed: ${errorCodeOf(error)}`);
  return { ok: false, error: portfolioErrorMessage("DATABASE_ERROR") };
}

function invalid(error: z.ZodError): Fail {
  const r = validationFailure(error) as Fail;
  return {
    ok: false,
    error: r.error ?? portfolioErrorMessage("INVALID_INPUT"),
    fieldErrors: r.fieldErrors,
  };
}

function refresh() {
  revalidatePath("/dashboard/portfolio", "layout");
  revalidatePath("/dashboard/skill-passport", "layout");
  revalidatePath("/p/[username]", "layout");
}

export async function updatePortfolioProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = portfolioProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await updatePortfolioProfile(user.id, parsed.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Profile saved" };
}

const saveProjectSchema = z.object({ id: idSchema.nullable(), project: z.unknown() });

export async function saveProjectAction(
  input: unknown,
): Promise<{ ok: true; projectId: string } | Fail> {
  const user = await requireUser();
  const outer = saveProjectSchema.safeParse(input);
  if (!outer.success) return { ok: false, error: portfolioErrorMessage("PROJECT_NOT_FOUND") };
  const parsed = projectSchema.safeParse(outer.data.project);
  if (!parsed.success) return invalid(parsed.error);
  try {
    let projectId = outer.data.id;
    if (projectId) await updateProject(user.id, projectId, parsed.data);
    else projectId = (await createProject(user.id, parsed.data)).id;
    refresh();
    return { ok: true, projectId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteItemAction(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = itemRefSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: portfolioErrorMessage("NOT_FOUND") };
  try {
    await deleteItem(user.id, parsed.data.kind, parsed.data.id);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function setVisibilityAction(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = visibilityToggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: portfolioErrorMessage("NOT_FOUND") };
  try {
    await setVisibility(user.id, parsed.data.kind, parsed.data.id, parsed.data.visibility);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function setFeaturedAction(input: unknown): Promise<{ ok: true } | Fail> {
  const user = await requireUser();
  const parsed = z.object({ id: idSchema, featured: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: portfolioErrorMessage("PROJECT_NOT_FOUND") };
  try {
    await setFeatured(user.id, parsed.data.id, parsed.data.featured);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true };
}

export async function addEvidenceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await addEvidence(user.id, parsed.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Evidence added" };
}

export async function addSkillAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = skillSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await addSkill(user.id, parsed.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Skill added" };
}

export async function updateSkillAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = skillUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await updateSkill(user.id, parsed.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Skill saved" };
}

const SECTION_SCHEMAS = {
  education: educationSchema,
  certification: certificationSchema,
  achievement: achievementSchema,
  experience: experienceSchema,
} as const;

export async function saveSectionAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const outer = z
    .object({
      kind: z.enum(["education", "certification", "achievement", "experience"]),
      id: idSchema.nullable(),
      data: z.unknown(),
    })
    .safeParse(input);
  if (!outer.success) return { ok: false, error: portfolioErrorMessage("NOT_FOUND") };
  const { kind, id } = outer.data;
  const parsed = SECTION_SCHEMAS[kind].safeParse(outer.data.data);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await saveSectionItem(user.id, kind, id, parsed.data as never);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Saved" };
}

export async function updateSettingsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await updateSettings(user.id, parsed.data);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Settings saved" };
}

/* ─── AI assistance (suggestions only; nothing is saved here) ───────────────── */

async function aiLimited(userId: string): Promise<Fail | null> {
  const limit = await portfolioAiLimiter(userId);
  if (limit.ok) return null;
  return {
    ok: false,
    error: portfolioErrorMessage("RATE_LIMITED", {
      minutes: String(Math.max(1, Math.ceil(limit.retryAfterSeconds / 60))),
    }),
  };
}

export async function aiHeadlineAction(): Promise<{ ok: true; text: string } | Fail> {
  const user = await requireUser();
  const limited = await aiLimited(user.id);
  if (limited) return limited;
  try {
    return { ok: true, text: await aiHeadline(user.id) };
  } catch (error) {
    return failure(error);
  }
}

export async function aiBioAction(): Promise<{ ok: true; text: string; dropped: number } | Fail> {
  const user = await requireUser();
  const limited = await aiLimited(user.id);
  if (limited) return limited;
  try {
    const result = await aiBio(user.id);
    return { ok: true, text: result.bio, dropped: result.dropped };
  } catch (error) {
    return failure(error);
  }
}

const projectDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  shortDescription: z.string().trim().min(1).max(240),
  description: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => v || null),
  role: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  technologies: z.array(z.string().trim().min(1).max(40)).max(20),
  skills: z.array(z.string().trim().min(1).max(40)).max(12),
  status: z.string().max(20),
});

export async function aiProjectAction(
  input: unknown,
): Promise<{ ok: true; text: string; dropped: number } | Fail> {
  const user = await requireUser();
  const parsed = projectDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a title and short description first." };
  const limited = await aiLimited(user.id);
  if (limited) return limited;
  try {
    const result = await aiProject(user.id, parsed.data);
    return { ok: true, text: result.description, dropped: result.dropped };
  } catch (error) {
    return failure(error);
  }
}

export async function aiSkillSummaryAction(
  userSkillId: unknown,
): Promise<{ ok: true; text: string } | Fail> {
  const user = await requireUser();
  const id = idSchema.safeParse(userSkillId);
  if (!id.success) return { ok: false, error: portfolioErrorMessage("SKILL_NOT_FOUND") };
  const skill = await getMySkill(id.data);
  if (!skill) return { ok: false, error: portfolioErrorMessage("SKILL_NOT_FOUND") };
  const limited = await aiLimited(user.id);
  if (limited) return limited;
  try {
    const evidence = skill.evidence.items.map((i) => `${i.label} (${i.detail})`);
    return { ok: true, text: await aiSkillSummary(user.id, skill.name, evidence) };
  } catch (error) {
    return failure(error);
  }
}
