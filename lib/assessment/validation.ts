import { z } from "zod";
import {
  ASSESSMENT_TYPES,
  DIFFICULTIES,
  FOCUSES,
  MAX_SKILLS,
  MIN_MIXED_SKILLS,
  QUESTION_COUNTS,
  TEXT_ANSWER_MAX,
  TIME_LIMITS,
} from "./constants";
import { supportedSkill } from "./skills";

/** Ids arrive from the browser: validate their shape; ownership is checked server-side. */
export const idSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+$/i);

const skillSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((s, ctx) => {
    const canonical = supportedSkill(s);
    if (!canonical) {
      ctx.addIssue({ code: "custom", message: "Choose a supported skill." });
      return z.NEVER;
    }
    return canonical;
  });

const configSchema = z.object({
  type: z.enum(ASSESSMENT_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  questionCount: z.coerce
    .number()
    .int()
    .refine(
      (n) => (QUESTION_COUNTS as readonly number[]).includes(n),
      "Choose 5, 10, 15 or 20 questions.",
    ),
  /** "" or null = no limit. */
  timeLimitMinutes: z
    .union([z.literal(""), z.null(), z.coerce.number().int()])
    .transform((v) => (v === "" || v === null ? null : v))
    .refine(
      (v) => (TIME_LIMITS as readonly (number | null)[]).includes(v),
      "Choose a valid time limit.",
    ),
  focus: z.enum(FOCUSES),
});

/** Any browser-supplied userId is stripped: only the session user is ever used. */
export const createAssessmentSchema = z.discriminatedUnion("source", [
  configSchema.extend({ source: z.literal("JOB_MATCH"), jobId: idSchema }),
  configSchema.extend({ source: z.literal("CAREER_GOAL"), cvId: idSchema }),
  configSchema.extend({
    source: z.literal("SKILL"),
    cvId: idSchema,
    skills: z.array(skillSchema).length(1),
  }),
  configSchema.extend({
    source: z.literal("MIXED"),
    cvId: idSchema,
    skills: z
      .array(skillSchema)
      .min(MIN_MIXED_SKILLS, `Choose at least ${MIN_MIXED_SKILLS} skills.`)
      .max(MAX_SKILLS, `Choose at most ${MAX_SKILLS} skills.`)
      .refine((s) => new Set(s).size === s.length, "Each skill can only be chosen once."),
  }),
]);

export type CreateAssessmentInput = z.input<typeof createAssessmentSchema>;
export type CreateAssessmentData = z.output<typeof createAssessmentSchema>;
export type AssessmentConfig = z.output<typeof configSchema>;

export const saveAnswerSchema = z.object({
  questionId: idSchema,
  response: z
    .string()
    .trim()
    .min(1, "Choose or write an answer before saving.")
    .max(
      TEXT_ANSWER_MAX,
      `Keep your answer under ${TEXT_ANSWER_MAX.toLocaleString("en")} characters.`,
    ),
});
