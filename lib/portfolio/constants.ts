/** Client-safe portfolio labels and options. Values mirror the Prisma enums. */

export const VISIBILITIES = ["PRIVATE", "PUBLIC"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  PRIVATE: "Private",
  PUBLIC: "Public",
};

export const PROJECT_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const EVIDENCE_KINDS = [
  "REPOSITORY",
  "LIVE_DEMO",
  "DOCUMENTATION",
  "CERTIFICATE",
  "SCREENSHOT",
  "PUBLICATION",
  "OTHER",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  REPOSITORY: "Repository",
  LIVE_DEMO: "Live demo",
  DOCUMENTATION: "Documentation",
  CERTIFICATE: "Certificate",
  SCREENSHOT: "Screenshot",
  PUBLICATION: "Publication",
  OTHER: "Other link",
};

export const ACHIEVEMENT_KINDS = [
  "COMPETITION",
  "HACKATHON",
  "AWARD",
  "PUBLICATION",
  "EVENT",
  "RECOGNITION",
  "OTHER",
] as const;
export type AchievementKind = (typeof ACHIEVEMENT_KINDS)[number];
export const ACHIEVEMENT_KIND_LABELS: Record<AchievementKind, string> = {
  COMPETITION: "Competition",
  HACKATHON: "Hackathon",
  AWARD: "Award",
  PUBLICATION: "Publication",
  EVENT: "Event participation",
  RECOGNITION: "Recognition",
  OTHER: "Other",
};

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "FREELANCE",
  "VOLUNTEER",
  "OTHER",
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  VOLUNTEER: "Volunteer",
  OTHER: "Other",
};

/** Self-assessed level chosen by the user. Never assigned by AI. */
export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
};

/** Public sections and the SkillPassport flag that controls each. */
export const SECTIONS = [
  { key: "showAbout", label: "About" },
  { key: "showProjects", label: "Projects" },
  { key: "showSkills", label: "Skills" },
  { key: "showEducation", label: "Education" },
  { key: "showCertifications", label: "Certifications" },
  { key: "showAchievements", label: "Achievements" },
  { key: "showExperience", label: "Experience" },
  { key: "showLinks", label: "Contact / links" },
  { key: "showAssessments", label: "Assessment results on skills" },
  { key: "showInterviewScore", label: "AI Interview evidence on skills" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

/** Usernames that would collide with app routes or look official. */
export const RESERVED_USERNAMES = new Set([
  "dashboard",
  "api",
  "login",
  "logout",
  "register",
  "signup",
  "signin",
  "admin",
  "administrator",
  "settings",
  "auth",
  "p",
  "passport",
  "portfolio",
  "skill-passport",
  "profile",
  "help",
  "support",
  "about",
  "pricing",
  "terms",
  "privacy",
  "static",
  "public",
  "assets",
  "_next",
  "root",
  "system",
  "skillforge",
  "me",
  "new",
  "edit",
]);

export const LIMITS = {
  headline: 120,
  bio: 600,
  title: 120,
  shortDescription: 240,
  description: 4000,
  role: 80,
  technology: 40,
  technologies: 20,
  skillName: 40,
  projectSkills: 12,
  evidence: 10,
  certificationSkills: 10,
  url: 2048,
  text: 200,
  longText: 2000,
} as const;
