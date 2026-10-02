/** Fields that count toward profile completion, in display order. */
export const COMPLETION_FIELDS = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "displayName", label: "Display name" },
  { key: "image", label: "Profile image" },
  { key: "careerGoal", label: "Career goal" },
  { key: "experienceLevel", label: "Experience level" },
  { key: "location", label: "Location" },
  { key: "bio", label: "Bio" },
] as const;

export type CompletionSource = Record<(typeof COMPLETION_FIELDS)[number]["key"], unknown>;

export type ProfileCompletion = {
  /** 0–100, rounded */
  percent: number;
  completed: number;
  total: number;
  missing: string[];
};

function isFilled(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

/** Computed from stored values only — no weighting or estimates. */
export function computeProfileCompletion(source: CompletionSource): ProfileCompletion {
  const missing = COMPLETION_FIELDS.filter((f) => !isFilled(source[f.key])).map((f) => f.label);
  const total = COMPLETION_FIELDS.length;
  const completed = total - missing.length;
  return { percent: Math.round((completed / total) * 100), completed, total, missing };
}
