/** Client-safe roadmap labels and options. Values mirror the Prisma enums. */

export const TASK_CATEGORIES = [
  "FUNDAMENTALS",
  "TECHNICAL_SKILL",
  "TOOL",
  "PROJECT",
  "PORTFOLIO",
  "INTERVIEW_PREPARATION",
  "CAREER_PREPARATION",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  FUNDAMENTALS: "Fundamentals",
  TECHNICAL_SKILL: "Technical skill",
  TOOL: "Tool",
  PROJECT: "Project",
  PORTFOLIO: "Portfolio",
  INTERVIEW_PREPARATION: "Interview preparation",
  CAREER_PREPARATION: "Career preparation",
};

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const TASK_STATUSES = ["LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  LOCKED: "Locked",
  AVAILABLE: "Available",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export const GAP_STATUSES = ["STRONG", "DEVELOPING", "NOT_DEMONSTRATED"] as const;
export type GapStatus = (typeof GAP_STATUSES)[number];

export const GAP_STATUS_LABELS: Record<GapStatus, string> = {
  STRONG: "Strong",
  DEVELOPING: "Developing",
  NOT_DEMONSTRATED: "Not demonstrated in your CV",
};

/** Optional target timeframes for career-goal roadmaps, in weeks. */
export const TIMEFRAMES = [4, 8, 12, 24] as const;
