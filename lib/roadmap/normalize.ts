import type { Priority, TaskCategory } from "./constants";
import { skillKey, taskPriorities } from "./prioritization";
import type { RoadmapModelOutput } from "./schema";
import { normalizePhaseWeeks, normalizeTaskTime } from "./time";

export type NormalizedTask = {
  key: string;
  position: number;
  phaseOrder: number;
  title: string;
  description: string;
  skill: string;
  category: TaskCategory;
  priority: Priority;
  estimatedHours: number;
  estimatedDays: number;
  /** Titles of prerequisite tasks, for display. */
  prerequisites: string[];
  dependsOn: string[];
  practicalOutcome: string;
  verificationMethod: string;
};

/**
 * Turns the model's phases into a consistent plan:
 *  - phases sorted and renumbered 1..n; milestones re-mapped (orphans dropped)
 *  - task keys made unique; tasks numbered in order
 *  - prerequisites kept only when they point to an EARLIER task (no forward
 *    references, so no cycles); others are dropped and counted
 *  - time estimates clamped and made consistent (lib/roadmap/time.ts)
 *  - priority computed deterministically (lib/roadmap/prioritization.ts)
 */
export function normalizePlan(
  output: Pick<RoadmapModelOutput, "phases" | "milestones">,
  gapPriorityBySkill: Map<string, Priority>,
) {
  const phases = [...output.phases].sort((a, b) => a.order - b.order);
  const orderMap = new Map(phases.map((p, i) => [p.order, i + 1]));

  const usedKeys = new Set<string>();
  const keyRename = new Map<string, string>();
  let droppedPrerequisites = 0;
  const draft: Omit<NormalizedTask, "priority">[] = [];

  phases.forEach((phase, phaseIndex) => {
    for (const task of phase.tasks) {
      let key = task.key.toLowerCase();
      for (let n = 2; usedKeys.has(key); n++) key = `${task.key.toLowerCase()}-${n}`;
      usedKeys.add(key);
      // First occurrence wins for references written with the original key.
      if (!keyRename.has(task.key.toLowerCase())) keyRename.set(task.key.toLowerCase(), key);

      const earlier = new Set(draft.map((t) => t.key));
      const dependsOn: string[] = [];
      for (const ref of task.prerequisites) {
        const target = keyRename.get(ref.toLowerCase());
        if (target && earlier.has(target) && !dependsOn.includes(target)) dependsOn.push(target);
        else droppedPrerequisites++;
      }

      const time = normalizeTaskTime(task.estimatedHours, task.estimatedDays);
      draft.push({
        key,
        position: draft.length + 1,
        phaseOrder: phaseIndex + 1,
        title: task.title,
        description: task.description,
        skill: task.skill,
        category: task.category,
        estimatedHours: time.estimatedHours,
        estimatedDays: time.estimatedDays,
        dependsOn,
        prerequisites: dependsOn.map((dep) => draft.find((t) => t.key === dep)!.title),
        practicalOutcome: task.practicalOutcome,
        verificationMethod: task.verificationMethod,
      });
    }
  });

  const priorities = taskPriorities(draft, gapPriorityBySkill);
  const tasks: NormalizedTask[] = draft.map((t) => ({ ...t, priority: priorities.get(t.key)! }));

  const normalizedPhases = phases.map((phase, i) => ({
    order: i + 1,
    title: phase.title,
    objective: phase.objective,
    estimatedWeeks: normalizePhaseWeeks(
      phase.estimatedWeeks,
      tasks.filter((t) => t.phaseOrder === i + 1).map((t) => t.estimatedDays),
    ),
  }));

  const milestones = output.milestones
    .filter((m) => orderMap.has(m.phaseOrder))
    .map((m) => ({ ...m, phaseOrder: orderMap.get(m.phaseOrder)! }));

  return {
    tasks,
    phases: normalizedPhases,
    milestones,
    totalWeeks: normalizedPhases.reduce((sum, p) => sum + p.estimatedWeeks, 0),
    droppedPrerequisites,
  };
}

export { skillKey };
