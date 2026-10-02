import { z } from "zod";
import { SCORING_VERSION } from "./scoring";

/**
 * Two schemas:
 *  - jobMatchModelOutputSchema: what an AI provider must return (validated, never trusted).
 *  - jobMatchReportSchema: what we store and render, after grounding and scoring.
 */

export const REQUIREMENT_KINDS = ["REQUIRED", "PREFERRED"] as const;
export const REQUIREMENT_CATEGORIES = [
  "SKILL",
  "TECHNOLOGY",
  "EXPERIENCE",
  "EDUCATION",
  "CERTIFICATION",
  "OTHER",
] as const;
/** PRESENT: the CV clearly shows it. PARTIAL: related evidence only. MISSING: no evidence in the CV. */
export const MATCH_LEVELS = ["PRESENT", "PARTIAL", "MISSING"] as const;
export const IMPORTANCE_LEVELS = ["CRITICAL", "IMPORTANT", "NICE_TO_HAVE"] as const;
export const SENIORITY_LEVELS = [
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "NOT_SPECIFIED",
] as const;
export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

const shortText = (max: number) => z.string().trim().min(1).max(max);
const rating = z.number().int().min(0).max(10);
const ratedDimension = z.object({ rating, rationale: shortText(400) });

export const requirementSchema = z.object({
  /** The requirement as the job states it. */
  requirement: shortText(200),
  /** Short name used for matching, e.g. "Docker", "Bachelor's degree". */
  term: shortText(60),
  kind: z.enum(REQUIREMENT_KINDS),
  category: z.enum(REQUIREMENT_CATEGORIES),
  importance: z.enum(IMPORTANCE_LEVELS),
  /** Verbatim quote from the job description. */
  evidenceFromJob: shortText(300),
  match: z.enum(MATCH_LEVELS),
  /** Verbatim quote from the CV; null when the CV shows nothing. */
  evidenceFromCv: z.string().trim().max(300).nullable(),
  explanation: shortText(300),
});

export const jobMatchModelOutputSchema = z.object({
  summary: shortText(1200),
  role: z.object({
    title: z.string().trim().max(120).nullable(),
    seniority: z.enum(SENIORITY_LEVELS),
  }),
  requirements: z.array(requirementSchema).max(40),
  responsibilities: z.array(shortText(240)).max(10),
  experienceRequirement: z.object({
    yearsMin: z.number().min(0).max(40).nullable(),
    description: z.string().trim().max(300).nullable(),
  }),
  educationRequirement: z.object({ description: z.string().trim().max(300).nullable() }),
  /** Important terms that appear in the job description. */
  keywords: z.array(shortText(60)).max(30),
  dimensions: z.object({
    experience: ratedDimension,
    education: ratedDimension,
    projects: ratedDimension,
  }),
  strengths: z.array(z.object({ area: shortText(120), explanation: shortText(400) })).max(6),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(PRIORITIES),
        recommendation: shortText(240),
        reason: shortText(400),
      }),
    )
    .max(8),
  interviewTopics: z.array(shortText(160)).max(8),
});

export type JobMatchModelOutput = z.infer<typeof jobMatchModelOutputSchema>;
export type Requirement = z.infer<typeof requirementSchema>;

export const DIMENSION_KEYS = [
  "requiredSkills",
  "preferredSkills",
  "experience",
  "education",
  "projects",
  "technology",
  "keywordCoverage",
] as const;

export const jobMatchReportSchema = z.object({
  reportVersion: z.literal(1),
  summary: z.string(),
  role: jobMatchModelOutputSchema.shape.role,
  requirements: z.array(requirementSchema.extend({ adjusted: z.boolean() })),
  responsibilities: z.array(z.string()),
  experienceRequirement: jobMatchModelOutputSchema.shape.experienceRequirement,
  educationRequirement: jobMatchModelOutputSchema.shape.educationRequirement,
  keywordCoverage: z.object({ matched: z.array(z.string()), missing: z.array(z.string()) }),
  dimensionRationales: z.object({
    experience: z.string(),
    education: z.string(),
    projects: z.string(),
  }),
  strengths: jobMatchModelOutputSchema.shape.strengths,
  recommendations: jobMatchModelOutputSchema.shape.recommendations,
  interviewTopics: z.array(z.string()),
  score: z.object({
    version: z.literal(SCORING_VERSION),
    overall: z.number().int().min(0).max(100),
    dimensions: z.array(
      z.object({
        key: z.enum(DIMENSION_KEYS),
        label: z.string(),
        weight: z.number(),
        /** Weight after redistributing non-applicable dimensions. */
        effectiveWeight: z.number(),
        /** 0–100, or null when not applicable to this job. */
        score: z.number().nullable(),
        basis: z.enum(["evidence", "rating"]),
        detail: z.string(),
      }),
    ),
  }),
  grounding: z.object({
    /** Requirements dropped because they couldn't be found in the job description. */
    removedRequirements: z.number().int().min(0),
    /** Requirements whose match level was corrected against the CV text. */
    adjustedRequirements: z.number().int().min(0),
  }),
  source: z.object({ cvTruncated: z.boolean() }),
});

export type JobMatchReport = z.infer<typeof jobMatchReportSchema>;
export type ReportRequirement = JobMatchReport["requirements"][number];
