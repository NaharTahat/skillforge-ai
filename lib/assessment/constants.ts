/** Client-safe assessment labels and options. Values mirror the Prisma enums. */

export const ASSESSMENT_SOURCES = ["JOB_MATCH", "CAREER_GOAL", "SKILL", "MIXED"] as const;
export type AssessmentSource = (typeof ASSESSMENT_SOURCES)[number];
export const SOURCE_LABELS: Record<AssessmentSource, string> = {
  JOB_MATCH: "Job Match",
  CAREER_GOAL: "Career Goal",
  SKILL: "Skill",
  MIXED: "Mixed skills",
};

export const ASSESSMENT_TYPES = ["TECHNICAL", "CONCEPTUAL", "PRACTICAL", "MIXED"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export const TYPE_LABELS: Record<AssessmentType, string> = {
  TECHNICAL: "Technical",
  CONCEPTUAL: "Conceptual",
  PRACTICAL: "Practical",
  MIXED: "Mixed",
};

export const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ADAPTIVE"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ADAPTIVE: "Adaptive",
};

export const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type QuestionLevel = (typeof LEVELS)[number];
/**
 * Keyed by the shared database SkillLevel enum. "EXPERT" exists for Phase 8
 * self-assessed skill levels and is never planned for an assessment question.
 */
export const LEVEL_LABELS: Record<QuestionLevel | "EXPERT", string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

export const QUESTION_COUNTS = [5, 10, 15, 20] as const;
export const DEFAULT_QUESTION_COUNT = 10;

/** Minutes; null = no limit. */
export const TIME_LIMITS = [null, 15, 30, 45, 60] as const;
export const DEFAULT_TIME_LIMIT = 30;

export const FOCUSES = [
  "CORE_CONCEPTS",
  "PROBLEM_SOLVING",
  "PRACTICAL_APPLICATION",
  "TECHNICAL_KNOWLEDGE",
  "REAL_WORLD_SCENARIOS",
  "MIXED",
] as const;
export type Focus = (typeof FOCUSES)[number];
export const FOCUS_LABELS: Record<Focus, string> = {
  CORE_CONCEPTS: "Core concepts",
  PROBLEM_SOLVING: "Problem solving",
  PRACTICAL_APPLICATION: "Practical application",
  TECHNICAL_KNOWLEDGE: "Technical knowledge",
  REAL_WORLD_SCENARIOS: "Real-world scenarios",
  MIXED: "Mixed",
};

export const STATUSES = [
  "DRAFT",
  "GENERATING",
  "IN_PROGRESS",
  "COMPLETED",
  "EXPIRED",
  "FAILED",
] as const;
export type AssessmentStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  DRAFT: "Queued",
  GENERATING: "Generating",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  EXPIRED: "Time expired",
  FAILED: "Failed",
};

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "SCENARIO",
  "TECHNICAL",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  TRUE_FALSE: "True or false",
  SHORT_ANSWER: "Short answer",
  SCENARIO: "Scenario",
  TECHNICAL: "Technical",
};
/** Graded automatically (1 or 0); the others are evaluated as text. Code is never executed. */
export const OBJECTIVE_TYPES: readonly QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE"];
export const isObjective = (type: QuestionType) => OBJECTIVE_TYPES.includes(type);

export const QUESTION_SOURCES = [
  "CV_ANALYSIS",
  "JOB_MATCH",
  "CAREER_GOAL",
  "ROADMAP",
  "SKILL_SELECTION",
] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];
export const QUESTION_SOURCE_LABELS: Record<QuestionSource, string> = {
  CV_ANALYSIS: "CV analysis",
  JOB_MATCH: "Job Match",
  CAREER_GOAL: "Career goal",
  ROADMAP: "Career roadmap",
  SKILL_SELECTION: "Your skill selection",
};

/** Score categories. Each question type maps to exactly one (see QUESTION_CATEGORY). */
export const CATEGORIES = [
  "TECHNICAL_KNOWLEDGE",
  "PROBLEM_SOLVING",
  "PRACTICAL_APPLICATION",
  "CONCEPTS",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  TECHNICAL_KNOWLEDGE: "Technical knowledge",
  PROBLEM_SOLVING: "Problem solving",
  PRACTICAL_APPLICATION: "Practical application",
  CONCEPTS: "Concepts",
};
export const QUESTION_CATEGORY: Record<QuestionType, Category> = {
  MULTIPLE_CHOICE: "TECHNICAL_KNOWLEDGE",
  TRUE_FALSE: "CONCEPTS",
  SHORT_ANSWER: "CONCEPTS",
  SCENARIO: "PRACTICAL_APPLICATION",
  TECHNICAL: "PROBLEM_SOLVING",
};

export const PERFORMANCE_LEVELS = [
  "NEEDS_IMPROVEMENT",
  "DEVELOPING",
  "COMPETENT",
  "STRONG",
] as const;
export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number];
export const PERFORMANCE_LABELS: Record<PerformanceLevel, string> = {
  NEEDS_IMPROVEMENT: "Needs improvement",
  DEVELOPING: "Developing",
  COMPETENT: "Competent",
  STRONG: "Strong",
};

/** At most this many skills per assessment. */
export const MAX_SKILLS = 6;
/** Mixed assessments need at least this many selected skills. */
export const MIN_MIXED_SKILLS = 2;
export const TEXT_ANSWER_MAX = 4000;
/** Answers arriving this soon after the deadline still count (network latency). */
export const EXPIRY_GRACE_SECONDS = 30;
