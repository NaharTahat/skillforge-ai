import type { TaskStatus } from "./constants";

/**
 * Progress is counted in tasks, not hours or AI estimates: completed / total.
 * 5 of 12 tasks completed → 41.7%.
 */
export type Progress = {
  total: number;
  completed: number;
  inProgress: number;
  /** 0–100, one decimal place. */
  percent: number;
};

export function computeProgress(tasks: { status: TaskStatus }[]): Progress {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 1000) / 10;
  return { total, completed, inProgress, percent };
}

export function progressByPhase(
  tasks: { status: TaskStatus; phaseOrder: number }[],
): Map<number, Progress> {
  const phases = new Map<number, { status: TaskStatus }[]>();
  for (const task of tasks) {
    const list = phases.get(task.phaseOrder) ?? [];
    list.push(task);
    phases.set(task.phaseOrder, list);
  }
  return new Map([...phases].map(([order, list]) => [order, computeProgress(list)]));
}

/** "41.7%" or "40%" — trims a trailing ".0". */
export function formatPercent(percent: number): string {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}
