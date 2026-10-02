/**
 * Deterministic portfolio completion: each item counts equally and is either
 * done or not, based only on stored data. No AI involved.
 */
export const COMPLETION_ITEMS = [
  { key: "name", label: "Add your name", href: "/dashboard/profile" },
  { key: "headline", label: "Add a profile headline", href: "/dashboard/portfolio/edit" },
  { key: "bio", label: "Write a short bio", href: "/dashboard/portfolio/edit" },
  { key: "project", label: "Add your first project", href: "/dashboard/portfolio/projects/new" },
  { key: "skills", label: "Add at least three skills", href: "/dashboard/portfolio/skills" },
  {
    key: "skillEvidence",
    label: "Add skill evidence (link a skill to a project or certification)",
    href: "/dashboard/portfolio/projects",
  },
  { key: "education", label: "Add education", href: "/dashboard/portfolio/edit#education" },
  {
    key: "certification",
    label: "Add a certification",
    href: "/dashboard/portfolio/edit#certifications",
  },
  {
    key: "achievement",
    label: "Add an achievement",
    href: "/dashboard/portfolio/edit#achievements",
  },
  {
    key: "public",
    label: "Choose a username and enable your public portfolio",
    href: "/dashboard/portfolio/settings",
  },
] as const;

export type CompletionKey = (typeof COMPLETION_ITEMS)[number]["key"];

export type CompletionInput = {
  hasName: boolean;
  headline: string | null;
  bio: string | null;
  projects: number;
  skills: number;
  /** Skills with at least one project or certification link. */
  skillsWithEvidence: number;
  educations: number;
  certifications: number;
  achievements: number;
  isPublic: boolean;
  username: string | null;
};

export function computePortfolioCompletion(input: CompletionInput) {
  const done: Record<CompletionKey, boolean> = {
    name: input.hasName,
    headline: Boolean(input.headline?.trim()),
    bio: Boolean(input.bio?.trim()),
    project: input.projects > 0,
    skills: input.skills >= 3,
    skillEvidence: input.skillsWithEvidence > 0,
    education: input.educations > 0,
    certification: input.certifications > 0,
    achievement: input.achievements > 0,
    public: input.isPublic && Boolean(input.username),
  };
  const completed = COMPLETION_ITEMS.filter((i) => done[i.key]).length;
  return {
    percent: Math.round((completed / COMPLETION_ITEMS.length) * 100),
    completed,
    total: COMPLETION_ITEMS.length,
    todo: COMPLETION_ITEMS.filter((i) => !done[i.key]),
  };
}
