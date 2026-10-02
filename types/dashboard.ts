/**
 * Data contract for the dashboard overview. Both the mock service and the
 * future database-backed service must return exactly this shape.
 */

/** Where the data came from. The UI labels anything that is not "live". */
export type DataSource = "mock" | "live";

export type SkillProgress = {
  name: string;
  /** 0–100 */
  proficiency: number;
};

export type CvStatusSummary =
  | { state: "missing" }
  | { state: "processing"; fileName: string }
  | { state: "analyzed"; fileName: string; score: number; analyzedAt: string };

export type JobMatchSummary = {
  strong: number;
  potential: number;
  topMatch?: { title: string; company: string; matchPercent: number };
};

export type RecommendedSkill = {
  name: string;
  reason: string;
  /** How many of the user's tracked jobs list this skill. */
  demandCount: number;
};

export type RoadmapSummary = {
  goal: string;
  /** 0–100 */
  completedPercent: number;
  completedItems: number;
  totalItems: number;
  nextItem?: { title: string; estimatedHours: number };
};

export type InterviewSummary = {
  /** 0–100, most recent completed session. */
  latestScore: number;
  sessionsCompleted: number;
  history: { label: string; score: number }[];
};

export type ActivityItem = {
  id: string;
  kind: "cv" | "job" | "roadmap" | "interview" | "assessment" | "project";
  title: string;
  /** ISO-8601 timestamp */
  occurredAt: string;
};

export type DashboardOverview = {
  source: DataSource;
  /** 0–100 composite readiness for the user's career goal. */
  careerReadiness: number;
  careerGoal: string;
  skills: SkillProgress[];
  cv: CvStatusSummary;
  jobMatches: JobMatchSummary;
  recommendedSkills: RecommendedSkill[];
  roadmap: RoadmapSummary;
  interview: InterviewSummary;
  recentActivity: ActivityItem[];
};
