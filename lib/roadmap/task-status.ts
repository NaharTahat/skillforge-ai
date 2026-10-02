import type { TaskStatus } from "./constants";

/**
 * Task status rules (no AI involved):
 *  - LOCKED / AVAILABLE are decided by the system from prerequisites.
 *  - Users may move a task between AVAILABLE, IN_PROGRESS and COMPLETED, but
 *    never out of LOCKED and never into LOCKED.
 */
export const USER_SETTABLE_STATUSES = ["AVAILABLE", "IN_PROGRESS", "COMPLETED"] as const;
export type UserSettableStatus = (typeof USER_SETTABLE_STATUSES)[number];

export type TransitionCheck = { ok: true } | { ok: false; reason: "LOCKED" | "UNCHANGED" };

export function checkTransition(from: TaskStatus, to: UserSettableStatus): TransitionCheck {
  if (from === "LOCKED") return { ok: false, reason: "LOCKED" };
  if (from === to) return { ok: false, reason: "UNCHANGED" };
  return { ok: true };
}

/**
 * Recomputes LOCKED / AVAILABLE for tasks the user hasn't started. A task is
 * locked while any task it depends on isn't completed. Started or completed
 * tasks keep their status even if a prerequisite is later reopened.
 */
export function resolveLocks<T extends { key: string; status: TaskStatus; dependsOn: string[] }>(
  tasks: T[],
): Map<string, TaskStatus> {
  const statusByKey = new Map(tasks.map((t) => [t.key, t.status]));
  const result = new Map<string, TaskStatus>();
  for (const task of tasks) {
    if (task.status === "IN_PROGRESS" || task.status === "COMPLETED") {
      result.set(task.key, task.status);
      continue;
    }
    const blocked = task.dependsOn.some((dep) => {
      const depStatus = statusByKey.get(dep);
      return depStatus !== undefined && depStatus !== "COMPLETED";
    });
    result.set(task.key, blocked ? "LOCKED" : "AVAILABLE");
  }
  return result;
}
