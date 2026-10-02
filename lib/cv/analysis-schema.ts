import { z } from "zod";
import { DIMENSION_KEYS, SCORING_VERSION, type DimensionKey } from "./scoring";

/**
 * Two schemas:
 *  - cvModelOutputSchema: what an AI provider must return (validated, never trusted).
 *  - cvAnalysisReportSchema: what we store and render, after grounding and scoring.
 */

export const SKILL_CATEGORIES = [
  "PROGRAMMING",
  "AI_ML",
  "DATA",
  "CLOUD_DEVOPS",
  "WEB",
  "SECURITY",
  "TOOLS",
  "SOFT_SKILLS",
  "OTHER",
] as const;

export const SKILL_CATEGORY_LABELS: Record<(typeof SKILL_CATEGORIES)[number], string> = {
  PROGRAMMING: "Programming",
  AI_ML: "AI / ML",
  DATA: "Data",
  CLOUD_DEVOPS: "Cloud & DevOps",
  WEB: "Web",
  SECURITY: "Security",
  TOOLS: "Tools",
  SOFT_SKILLS: "Soft skills",
  OTHER: "Other",
};

export const CANDIDATE_LEVELS = [
  "STUDENT",
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "NOT_SPECIFIED",
] as const;

export const GAP_TYPES = ["MISSING", "WEAK", "NOT_SPECIFIED"] as const;
export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

const rating = z.number().int().min(0).max(10);
const shortText = (max: number) => z.string().trim().min(1).max(max);

const dimensionShape = Object.fromEntries(
  DIMENSION_KEYS.map((key) => [key, z.object({ rating, rationale: shortText(400) })]),
) as Record<DimensionKey, z.ZodObject<{ rating: typeof rating; rationale: z.ZodString }>>;

export const cvModelOutputSchema = z.object({
  summary: shortText(1200),
  candidateProfile: z.object({
    targetRoles: z.array(shortText(80)).max(5),
    experienceLevel: z.enum(CANDIDATE_LEVELS),
    primaryDomain: z.string().trim().max(80).nullable(),
    yearsOfExperience: z.number().min(0).max(60).nullable(),
  }),
  skills: z
    .array(
      z.object({
        name: shortText(60),
        category: z.enum(SKILL_CATEGORIES),
        evidence: shortText(300),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(60),
  strengths: z.array(z.object({ title: shortText(120), evidence: shortText(300) })).max(8),
  gaps: z
    .array(z.object({ area: shortText(80), type: z.enum(GAP_TYPES), detail: shortText(300) }))
    .max(10),
  recommendations: z
    .array(
      z.object({ priority: z.enum(PRIORITIES), title: shortText(120), detail: shortText(400) }),
    )
    .max(10),
  sections: z.object({
    contact: z.boolean(),
    summary: z.boolean(),
    education: z.boolean(),
    experience: z.boolean(),
    skills: z.boolean(),
    projects: z.boolean(),
    certifications: z.boolean(),
  }),
  formatting: z.object({ readability: rating, consistency: rating, structure: rating }),
  dimensions: z.object(dimensionShape),
});

export type CvModelOutput = z.infer<typeof cvModelOutputSchema>;

export const cvAnalysisReportSchema = z.object({
  reportVersion: z.literal(1),
  summary: z.string(),
  candidateProfile: cvModelOutputSchema.shape.candidateProfile,
  skills: z.array(cvModelOutputSchema.shape.skills.element.extend({ verified: z.boolean() })),
  strengths: cvModelOutputSchema.shape.strengths,
  gaps: cvModelOutputSchema.shape.gaps,
  recommendations: cvModelOutputSchema.shape.recommendations,
  sections: cvModelOutputSchema.shape.sections,
  formatting: cvModelOutputSchema.shape.formatting,
  score: z.object({
    version: z.literal(SCORING_VERSION),
    overall: z.number().int().min(0).max(100),
    dimensions: z.array(
      z.object({
        key: z.enum(DIMENSION_KEYS),
        label: z.string(),
        weight: z.number(),
        rating: z.number(),
        points: z.number(),
        rationale: z.string(),
      }),
    ),
  }),
  grounding: z.object({
    /** Items dropped because they could not be found in the CV text. */
    removedSkills: z.number().int().min(0),
    removedStrengths: z.number().int().min(0),
  }),
  source: z.object({ truncated: z.boolean(), wordCount: z.number().int().min(0) }),
});

export type CvAnalysisReport = z.infer<typeof cvAnalysisReportSchema>;
