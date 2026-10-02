/** Client-safe interview labels and options. Values mirror the Prisma enums. */

export const INTERVIEW_TYPES = ["TECHNICAL", "BEHAVIORAL", "MIXED", "HR_GENERAL"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  MIXED: "Mixed",
  HR_GENERAL: "HR / General",
};

export const DIFFICULTIES = ["ENTRY", "INTERMEDIATE", "ADVANCED"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  ENTRY: "Entry",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const QUESTION_COUNTS = [5, 10, 15] as const;
export const DEFAULT_QUESTION_COUNT = 10;

export const FOCUSES = [
  "JOB_REQUIREMENTS",
  "MISSING_SKILLS",
  "TECHNICAL_DEPTH",
  "BEHAVIORAL",
  "PROJECTS",
  "GENERAL",
] as const;
export type Focus = (typeof FOCUSES)[number];
export const FOCUS_LABELS: Record<Focus, string> = {
  JOB_REQUIREMENTS: "Job requirements",
  MISSING_SKILLS: "Missing skills",
  TECHNICAL_DEPTH: "Technical depth",
  BEHAVIORAL: "Behavioral",
  PROJECTS: "Projects",
  GENERAL: "General interview",
};
/** Focuses that need a job description. */
export const JOB_ONLY_FOCUSES: readonly Focus[] = ["JOB_REQUIREMENTS"];

export const INTERVIEW_STATUSES = [
  "DRAFT",
  "GENERATING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];
export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  DRAFT: "Queued",
  GENERATING: "Generating",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export const QUESTION_KINDS = [
  "TECHNICAL",
  "BEHAVIORAL",
  "PROJECT",
  "CV",
  "JOB",
  "GAP",
  "HR",
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  PROJECT: "Project",
  CV: "CV-based",
  JOB: "Job-specific",
  GAP: "Skill exploration",
  HR: "HR / General",
};

export const QUESTION_SOURCES = [
  "CV",
  "CV_ANALYSIS",
  "JOB_DESCRIPTION",
  "JOB_MATCH",
  "CAREER_GOAL",
  "ROADMAP",
  "GENERAL",
] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];
export const QUESTION_SOURCE_LABELS: Record<QuestionSource, string> = {
  CV: "Your CV",
  CV_ANALYSIS: "CV analysis",
  JOB_DESCRIPTION: "Job description",
  JOB_MATCH: "Job Match",
  CAREER_GOAL: "Career goal",
  ROADMAP: "Career roadmap",
  GENERAL: "General interview practice",
};

export const QUESTION_STATUSES = ["PENDING", "ANSWERED", "SKIPPED"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const ANSWER_STATUSES = ["EVALUATING", "EVALUATED", "FAILED"] as const;
export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

export const VERDICTS = ["STRONG", "PARTIAL", "WEAK_EVIDENCE", "INCORRECT"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABELS: Record<Verdict, string> = {
  STRONG: "Strong answer",
  PARTIAL: "Partial answer",
  WEAK_EVIDENCE: "Needs more evidence",
  INCORRECT: "Contains inaccuracies",
};
export const VERDICT_DESCRIPTIONS: Record<Verdict, string> = {
  STRONG: "Relevant and accurate, with good support.",
  PARTIAL: "Some important points are there; others are missing.",
  WEAK_EVIDENCE: "The answer doesn't yet give enough concrete evidence.",
  INCORRECT: "Some of the technical content isn't accurate.",
};

export const DIMENSIONS = [
  "technicalAccuracy",
  "relevance",
  "completeness",
  "clarity",
  "communication",
  "evidence",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const DIMENSION_LABELS: Record<Dimension, string> = {
  technicalAccuracy: "Technical accuracy",
  relevance: "Relevance",
  completeness: "Completeness",
  clarity: "Clarity",
  communication: "Communication",
  evidence: "Evidence",
};

/** Follow-ups allowed per primary question. */
export const MAX_FOLLOW_UPS = 2;

/** Answer length limits (characters). */
export const ANSWER_MIN = 2;
export const ANSWER_MAX = 5000;
