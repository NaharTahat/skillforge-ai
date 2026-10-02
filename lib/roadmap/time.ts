/**
 * Realistic time estimates. AI estimates are clamped and made consistent:
 *  - hours per task: 1–120
 *  - days per task: at least ceil(hours / 4) — about 4 focused hours a day,
 *    since most learners study alongside work or school — and at most 90
 *  - phase weeks: at least the task days laid end to end (5 study days a
 *    week), at most 26
 */
export const MAX_TASK_HOURS = 120;
export const MAX_TASK_DAYS = 90;
export const FOCUSED_HOURS_PER_DAY = 4;
export const STUDY_DAYS_PER_WEEK = 5;
export const MAX_PHASE_WEEKS = 26;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeTaskTime(hours: number, days: number) {
  const estimatedHours = clamp(hours, 1, MAX_TASK_HOURS);
  const minDays = Math.ceil(estimatedHours / FOCUSED_HOURS_PER_DAY);
  const estimatedDays = clamp(Math.max(days, minDays), 1, MAX_TASK_DAYS);
  return { estimatedHours, estimatedDays };
}

export function normalizePhaseWeeks(aiWeeks: number, taskDays: number[]) {
  const needed = Math.ceil(taskDays.reduce((sum, d) => sum + d, 0) / STUDY_DAYS_PER_WEEK);
  return clamp(Math.max(aiWeeks, needed), 1, MAX_PHASE_WEEKS);
}

export type EffortSize = "Small" | "Medium" | "Large";

/** Small: up to 5h · Medium: up to 15h · Large: more than 15h. */
export function effortSize(hours: number): EffortSize {
  if (hours <= 5) return "Small";
  if (hours <= 15) return "Medium";
  return "Large";
}
