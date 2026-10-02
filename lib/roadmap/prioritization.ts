import type { GapStatus, Priority, TaskCategory } from "./constants";

/**
 * DETERMINISTIC PRIORITIZATION
 *
 * The AI proposes skill gaps and tasks; priority is decided here.
 *
 * Skill-gap priority (job roadmaps use the job's REQUIRED/PREFERRED label;
 * career-goal roadmaps have no job description, so nothing is "required" and
 * the highest level they reach is HIGH for a critical skill that isn't shown):
 *
 *   status            kind        CRITICAL   IMPORTANT  NICE_TO_HAVE
 *   NOT_DEMONSTRATED  REQUIRED    critical   critical   high
 *   NOT_DEMONSTRATED  PREFERRED   high       medium     low
 *   NOT_DEMONSTRATED  (goal)      high       medium     low
 *   DEVELOPING        REQUIRED    high       high       medium
 *   DEVELOPING        PREFERRED   medium     medium     low
 *   DEVELOPING        (goal)      high       medium     low
 *   STRONG            any         low        low        low
 *
 * Task priority = the priority of the gap for the task's skill; tasks without
 * a matching gap use their category's default. A task that other tasks depend
 * on is raised to at least the priority of its dependents, capped at HIGH
 * (a foundation is important, but the gap it serves is what's critical).
 */

export type Importance = "CRITICAL" | "IMPORTANT" | "NICE_TO_HAVE";
export type RequirementKind = "REQUIRED" | "PREFERRED" | null;

const RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function higherPriority(a: Priority, b: Priority): Priority {
  return RANK[a] <= RANK[b] ? a : b;
}

export function comparePriority(a: Priority, b: Priority): number {
  return RANK[a] - RANK[b];
}

export function gapPriority(gap: {
  status: GapStatus;
  importance: Importance;
  requirementKind: RequirementKind;
}): Priority {
  const { status, importance, requirementKind: kind } = gap;
  if (status === "STRONG") return "LOW";

  if (status === "NOT_DEMONSTRATED") {
    if (kind === "REQUIRED") return importance === "NICE_TO_HAVE" ? "HIGH" : "CRITICAL";
    return importance === "CRITICAL" ? "HIGH" : importance === "IMPORTANT" ? "MEDIUM" : "LOW";
  }

  // DEVELOPING
  if (kind === "REQUIRED") return importance === "NICE_TO_HAVE" ? "MEDIUM" : "HIGH";
  if (kind === "PREFERRED") return importance === "NICE_TO_HAVE" ? "LOW" : "MEDIUM";
  return importance === "CRITICAL" ? "HIGH" : importance === "IMPORTANT" ? "MEDIUM" : "LOW";
}

const CATEGORY_DEFAULT: Record<TaskCategory, Priority> = {
  FUNDAMENTALS: "MEDIUM",
  TECHNICAL_SKILL: "MEDIUM",
  TOOL: "MEDIUM",
  PROJECT: "MEDIUM",
  PORTFOLIO: "MEDIUM",
  INTERVIEW_PREPARATION: "MEDIUM",
  CAREER_PREPARATION: "LOW",
};

export function skillKey(skill: string) {
  return skill.trim().toLowerCase().replace(/\s+/g, " ");
}

export function taskPriorities(
  tasks: { key: string; skill: string; category: TaskCategory; dependsOn: string[] }[],
  gapPriorityBySkill: Map<string, Priority>,
): Map<string, Priority> {
  const priority = new Map<string, Priority>(
    tasks.map((t) => [
      t.key,
      gapPriorityBySkill.get(skillKey(t.skill)) ?? CATEGORY_DEFAULT[t.category],
    ]),
  );

  // Propagate to prerequisites until stable. dependsOn only points to earlier
  // tasks, so walking from the end converges in one pass; loop for safety.
  for (let pass = 0; pass < tasks.length; pass++) {
    let changed = false;
    for (const task of [...tasks].reverse()) {
      const own = priority.get(task.key)!;
      // Prerequisites inherit their dependent's priority, capped at HIGH.
      const inherited: Priority = own === "CRITICAL" ? "HIGH" : own;
      for (const dep of task.dependsOn) {
        const current = priority.get(dep);
        if (!current) continue;
        const next = higherPriority(current, inherited);
        if (next !== current) {
          priority.set(dep, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return priority;
}
