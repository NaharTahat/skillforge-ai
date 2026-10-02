import { z } from "zod";
import { GAP_STATUSES, PRIORITIES, TASK_CATEGORIES } from "./constants";

/**
 * Two schemas:
 *  - roadmapModelOutputSchema: what an AI provider must return (validated, never trusted).
 *  - roadmapReportSchema: what we store and render after grounding and normalization.
 *    Tasks are not part of the report; they are stored as RoadmapItem rows.
 */

export const ROADMAP_VERSION = 1;

export const IMPORTANCE_LEVELS = ["CRITICAL", "IMPORTANT", "NICE_TO_HAVE"] as const;
export const REQUIREMENT_KINDS = ["REQUIRED", "PREFERRED"] as const;

const shortText = (max: number) => z.string().trim().min(1).max(max);
const quote = z.string().trim().max(300).nullable();

export const skillGapSchema = z.object({
  skill: shortText(60),
  status: z.enum(GAP_STATUSES),
  importance: z.enum(IMPORTANCE_LEVELS),
  /** Job roadmaps: how the job states it. Career-goal roadmaps: null. */
  requirementKind: z.enum(REQUIREMENT_KINDS).nullable(),
  reason: shortText(300),
  /** Verbatim CV quote supporting STRONG / DEVELOPING. */
  cvEvidence: quote,
  /** Verbatim job-description quote for the requirement (job roadmaps only). */
  targetEvidence: quote,
});

export const modelTaskSchema = z.object({
  /** Short unique key, e.g. "t3", referenced by other tasks' prerequisites. */
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{1,20}$/i),
  title: shortText(140),
  description: shortText(600),
  skill: shortText(60),
  category: z.enum(TASK_CATEGORIES),
  estimatedHours: z.number().int().min(1).max(200),
  estimatedDays: z.number().int().min(1).max(120),
  /** Keys of earlier tasks in this roadmap. */
  prerequisites: z.array(z.string().trim().max(20)).max(6),
  practicalOutcome: shortText(300),
  verificationMethod: shortText(300),
});

export const roadmapModelOutputSchema = z.object({
  title: shortText(120),
  summary: shortText(1200),
  currentProfile: z.object({
    /** Verbatim CV lines. */
    education: z.array(shortText(200)).max(5),
    strongSkills: z.array(shortText(60)).max(20),
    developingSkills: z.array(shortText(60)).max(20),
    technologies: z.array(shortText(60)).max(20),
    /** Verbatim CV lines. */
    relevantProjects: z.array(shortText(200)).max(5),
  }),
  skillGaps: z.array(skillGapSchema).max(30),
  phases: z
    .array(
      z.object({
        order: z.number().int().min(1).max(10),
        title: shortText(100),
        objective: shortText(300),
        estimatedWeeks: z.number().int().min(1).max(26),
        tasks: z.array(modelTaskSchema).min(1).max(8),
      }),
    )
    .min(1)
    .max(8),
  milestones: z
    .array(
      z.object({
        title: shortText(120),
        description: shortText(300),
        phaseOrder: z.number().int().min(1).max(10),
        verification: shortText(300),
      }),
    )
    .max(10),
  recommendations: z.array(shortText(300)).max(8),
});

export type RoadmapModelOutput = z.infer<typeof roadmapModelOutputSchema>;
export type ModelTask = z.infer<typeof modelTaskSchema>;
export type ModelSkillGap = z.infer<typeof skillGapSchema>;

export const roadmapReportSchema = z.object({
  reportVersion: z.literal(ROADMAP_VERSION),
  title: z.string(),
  summary: z.string(),
  target: z.object({
    type: z.enum(["job", "career_goal"]),
    title: z.string(),
    company: z.string().nullable(),
  }),
  sourceLabel: z.string(),
  currentProfile: z.object({
    education: z.array(z.string()),
    /** From the profile or CV analysis — never inferred by the roadmap AI. */
    experienceLevel: z.string(),
    strongSkills: z.array(z.string()),
    developingSkills: z.array(z.string()),
    technologies: z.array(z.string()),
    relevantProjects: z.array(z.string()),
  }),
  skillGaps: z.array(
    skillGapSchema.extend({ priority: z.enum(PRIORITIES), adjusted: z.boolean() }),
  ),
  phases: z.array(
    z.object({
      order: z.number().int(),
      title: z.string(),
      objective: z.string(),
      estimatedWeeks: z.number().int(),
    }),
  ),
  milestones: roadmapModelOutputSchema.shape.milestones,
  recommendations: z.array(z.string()),
  timeline: z.object({
    totalWeeks: z.number().int(),
    timeframeWeeks: z.number().int().nullable(),
  }),
  grounding: z.object({
    removedGaps: z.number().int().min(0),
    adjustedGaps: z.number().int().min(0),
    removedProfileItems: z.number().int().min(0),
    droppedPrerequisites: z.number().int().min(0),
  }),
});

export type RoadmapReport = z.infer<typeof roadmapReportSchema>;
export type ReportSkillGap = RoadmapReport["skillGaps"][number];
