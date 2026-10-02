import { z } from "zod";
import {
  ANSWER_MAX,
  ANSWER_MIN,
  DIFFICULTIES,
  FOCUSES,
  INTERVIEW_TYPES,
  QUESTION_COUNTS,
} from "./constants";

/** Ids arrive from the browser: validate their shape; ownership is checked server-side. */
export const idSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+$/i);

const configSchema = z.object({
  type: z.enum(INTERVIEW_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  questionCount: z.coerce
    .number()
    .int()
    .refine(
      (n) => (QUESTION_COUNTS as readonly number[]).includes(n),
      "Choose 5, 10 or 15 questions.",
    ),
  focus: z.enum(FOCUSES),
});

/** Any browser-supplied userId is stripped: only the session user is ever used. */
export const createInterviewSchema = z.discriminatedUnion("source", [
  configSchema.extend({ source: z.literal("JOB_MATCH"), jobId: idSchema }),
  configSchema.extend({
    source: z.literal("CAREER_GOAL"),
    cvId: idSchema,
    focus: z
      .enum(FOCUSES)
      .refine((f) => f !== "JOB_REQUIREMENTS", "Job requirements need a Job Match."),
  }),
]);

export type CreateInterviewInput = z.input<typeof createInterviewSchema>;
export type CreateInterviewData = z.output<typeof createInterviewSchema>;
export type InterviewConfig = z.output<typeof configSchema>;

export const submitAnswerSchema = z.object({
  questionId: idSchema,
  answer: z
    .string()
    .trim()
    .min(ANSWER_MIN, "Write an answer before submitting.")
    .max(ANSWER_MAX, `Keep your answer under ${ANSWER_MAX.toLocaleString("en")} characters.`),
});

export const questionActionSchema = z.object({ questionId: idSchema });
