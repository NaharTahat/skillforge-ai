import { z } from "zod";
import { TIMEFRAMES } from "./constants";
import { USER_SETTABLE_STATUSES } from "./task-status";

/** Ids arrive from the browser: validate their shape; ownership is checked server-side. */
export const idSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+$/i);

const timeframeSchema = z
  .union([
    z.literal(""),
    z.coerce.number().refine((n) => (TIMEFRAMES as readonly number[]).includes(n)),
  ])
  .transform((v) => (v === "" ? null : (v as number)));

export const createRoadmapSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("JOB_MATCH"), jobId: idSchema }),
  z.object({ source: z.literal("CAREER_GOAL"), cvId: idSchema, timeframeWeeks: timeframeSchema }),
]);

export type CreateRoadmapInput = z.input<typeof createRoadmapSchema>;
export type CreateRoadmapData = z.output<typeof createRoadmapSchema>;

export const taskStatusUpdateSchema = z.object({
  taskId: idSchema,
  status: z.enum(USER_SETTABLE_STATUSES),
});
