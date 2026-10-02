/**
 * Controlled lists for profile fields. Values mirror the Prisma enums
 * `CareerGoal` and `ExperienceLevel`; kept here so client code doesn't
 * import the database client.
 */
export const CAREER_GOALS = [
  { value: "AI_ENGINEER", label: "AI Engineer" },
  { value: "ML_ENGINEER", label: "Machine Learning Engineer" },
  { value: "DATA_SCIENTIST", label: "Data Scientist" },
  { value: "DATA_ANALYST", label: "Data Analyst" },
  { value: "SOFTWARE_ENGINEER", label: "Software Engineer" },
  { value: "CYBERSECURITY_ANALYST", label: "Cybersecurity Analyst" },
  { value: "FRONTEND_DEVELOPER", label: "Frontend Developer" },
  { value: "BACKEND_DEVELOPER", label: "Backend Developer" },
  { value: "FULL_STACK_DEVELOPER", label: "Full Stack Developer" },
  { value: "OTHER", label: "Other" },
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "STUDENT", label: "Student" },
  { value: "FRESH_GRADUATE", label: "Fresh Graduate" },
  { value: "JUNIOR", label: "Junior" },
  { value: "MID", label: "Mid-Level" },
  { value: "SENIOR", label: "Senior" },
] as const;

export type CareerGoalValue = (typeof CAREER_GOALS)[number]["value"];
export type ExperienceLevelValue = (typeof EXPERIENCE_LEVELS)[number]["value"];

export const careerGoalValues = CAREER_GOALS.map((g) => g.value) as [
  CareerGoalValue,
  ...CareerGoalValue[],
];
export const experienceLevelValues = EXPERIENCE_LEVELS.map((l) => l.value) as [
  ExperienceLevelValue,
  ...ExperienceLevelValue[],
];

export function careerGoalLabel(value: string | null | undefined) {
  return CAREER_GOALS.find((g) => g.value === value)?.label ?? null;
}
