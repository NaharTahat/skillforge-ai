import { z } from "zod";
import {
  ACHIEVEMENT_KINDS,
  EMPLOYMENT_TYPES,
  EVIDENCE_KINDS,
  LIMITS,
  PROJECT_STATUSES,
  RESERVED_USERNAMES,
  SKILL_LEVELS,
  VISIBILITIES,
} from "./constants";

/** Ids arrive from the browser: validate their shape; ownership is checked server-side. */
export const idSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+$/i);

/**
 * True for absolute http(s) URLs with a host and no embedded credentials.
 * Rejects javascript:, data:, file:, relative and protocol-relative URLs.
 */
export function isSafeUrl(value: string, { httpsOnly = false } = {}): boolean {
  if (value.length > LIMITS.url || /\s/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (httpsOnly ? url.protocol !== "https:" : url.protocol !== "https:" && url.protocol !== "http:")
    return false;
  if (url.username || url.password) return false;
  return url.hostname.includes(".") || url.hostname === "localhost";
}

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);
/** Empty string → null ("not set"). */
const optionalText = (max: number, label: string) =>
  text(max, label).transform((v) => (v === "" ? null : v));
const requiredText = (max: number, label: string) =>
  text(max, label).min(1, `${label} is required`);

const optionalUrl = (label: string, httpsOnly = false) =>
  z
    .string()
    .trim()
    .refine(
      (v) => v === "" || isSafeUrl(v, { httpsOnly }),
      `${label} must be a valid ${httpsOnly ? "https" : "http(s)"} URL`,
    )
    .transform((v) => (v === "" ? null : v));

/** "YYYY-MM-DD" (or "") → Date | null. */
const optionalDate = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))),
    "Use a valid date",
  )
  .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00Z`)));

const visibility = z.enum(VISIBILITIES);

function endAfterStart<T extends { startDate: Date | null; endDate: Date | null }>(
  v: T,
  ctx: z.RefinementCtx,
) {
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be after the start date",
    });
  }
}

/** Display skill name: trimmed, single-spaced, letters/digits and a few symbols only. */
export const skillNameSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter a skill name")
      .max(LIMITS.skillName, `Skill names must be at most ${LIMITS.skillName} characters`)
      .regex(
        /^[\p{L}\p{N}][\p{L}\p{N} .+#/&()-]*$/u,
        "Use letters, numbers and + # . / & ( ) - only",
      ),
  );

export const portfolioProfileSchema = z.object({
  headline: optionalText(LIMITS.headline, "Headline"),
  bio: optionalText(LIMITS.bio, "Bio"),
  location: optionalText(100, "Location"),
  websiteUrl: optionalUrl("Website"),
  githubUrl: optionalUrl("GitHub URL"),
  linkedinUrl: optionalUrl("LinkedIn URL"),
});
export type PortfolioProfileInput = z.input<typeof portfolioProfileSchema>;

export const projectSchema = z
  .object({
    title: requiredText(LIMITS.title, "Project title"),
    shortDescription: requiredText(LIMITS.shortDescription, "Short description"),
    description: optionalText(LIMITS.description, "Description"),
    role: optionalText(LIMITS.role, "Role"),
    technologies: z
      .array(requiredText(LIMITS.technology, "Technology"))
      .max(LIMITS.technologies, `At most ${LIMITS.technologies} technologies`)
      .transform((list) => [...new Map(list.map((t) => [t.toLowerCase(), t])).values()]),
    /** Ids of the user's own skills (UserSkill ids); ownership is checked server-side. */
    skillIds: z.array(idSchema).max(LIMITS.projectSkills, `At most ${LIMITS.projectSkills} skills`),
    repositoryUrl: optionalUrl("Repository URL"),
    liveUrl: optionalUrl("Live URL"),
    imageUrl: optionalUrl("Image URL", true),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(PROJECT_STATUSES),
    featured: z.boolean(),
    visibility,
  })
  .superRefine(endAfterStart);
export type ProjectInput = z.input<typeof projectSchema>;
export type ProjectData = z.output<typeof projectSchema>;

export const evidenceSchema = z.object({
  projectId: idSchema,
  kind: z.enum(EVIDENCE_KINDS),
  label: optionalText(80, "Label"),
  url: z
    .string()
    .trim()
    .refine((v) => isSafeUrl(v), "Enter a valid http(s) URL"),
});

export const skillSchema = z.object({
  name: skillNameSchema,
  level: z.enum(SKILL_LEVELS),
  visibility,
});
export const skillUpdateSchema = z.object({
  id: idSchema,
  level: z.enum(SKILL_LEVELS),
  visibility,
  summary: optionalText(400, "Summary"),
});

export const educationSchema = z
  .object({
    institution: requiredText(LIMITS.text, "Institution"),
    degree: optionalText(LIMITS.text, "Degree"),
    field: optionalText(LIMITS.text, "Field of study"),
    startDate: optionalDate,
    endDate: optionalDate,
    grade: optionalText(60, "Grade"),
    description: optionalText(LIMITS.longText, "Description"),
    visibility,
  })
  .superRefine(endAfterStart);

export const certificationSchema = z
  .object({
    name: requiredText(LIMITS.text, "Certification name"),
    issuer: requiredText(LIMITS.text, "Issuer"),
    issueDate: optionalDate,
    expirationDate: optionalDate,
    credentialId: optionalText(120, "Credential ID"),
    credentialUrl: optionalUrl("Credential URL"),
    description: optionalText(LIMITS.longText, "Description"),
    skills: z.array(skillNameSchema).max(LIMITS.certificationSkills),
    visibility,
  })
  .superRefine((v, ctx) => {
    if (v.issueDate && v.expirationDate && v.expirationDate < v.issueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expirationDate"],
        message: "Expiration must be after the issue date",
      });
    }
  });

export const achievementSchema = z.object({
  title: requiredText(LIMITS.text, "Title"),
  kind: z.enum(ACHIEVEMENT_KINDS),
  description: optionalText(LIMITS.longText, "Description"),
  issuer: optionalText(LIMITS.text, "Issuer / organizer"),
  date: optionalDate,
  url: optionalUrl("URL"),
  visibility,
});

export const experienceSchema = z
  .object({
    company: requiredText(LIMITS.text, "Company"),
    title: requiredText(LIMITS.text, "Job title"),
    description: optionalText(LIMITS.longText, "Description"),
    startDate: optionalDate,
    endDate: optionalDate,
    location: optionalText(100, "Location"),
    employmentType: z.union([z.enum(EMPLOYMENT_TYPES), z.literal("")]).transform((v) => v || null),
    visibility,
  })
  .superRefine(endAfterStart);

/** Lower-case, 3–30 chars, letters/digits/hyphens, no leading/trailing/double hyphen, not reserved. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames need at least 3 characters")
  .max(30, "Usernames can be at most 30 characters")
  .regex(
    /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/,
    "Use lowercase letters, numbers and single hyphens",
  )
  .refine((v) => !RESERVED_USERNAMES.has(v), "That username is reserved");

export const settingsSchema = z.object({
  username: z.union([z.literal(""), usernameSchema]).transform((v) => v || null),
  isPublic: z.boolean(),
  showAbout: z.boolean(),
  showProjects: z.boolean(),
  showSkills: z.boolean(),
  showEducation: z.boolean(),
  showCertifications: z.boolean(),
  showAchievements: z.boolean(),
  showExperience: z.boolean(),
  showLinks: z.boolean(),
  showAssessments: z.boolean(),
  showInterviewScore: z.boolean(),
});
export type SettingsInput = z.input<typeof settingsSchema>;

/** A typed (kind, id) pair for generic item actions. */
export const ITEM_KINDS = [
  "project",
  "education",
  "certification",
  "achievement",
  "experience",
  "skill",
  "evidence",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const itemRefSchema = z.object({ kind: z.enum(ITEM_KINDS), id: idSchema });
export const visibilityToggleSchema = itemRefSchema.extend({ visibility });
