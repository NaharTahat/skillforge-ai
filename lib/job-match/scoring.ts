import type { ReportRequirement } from "./schema";

/**
 * JOB MATCH SCORING METHODOLOGY (version 1)
 *
 * The AI never returns the final score. It classifies each job requirement
 * (PRESENT / PARTIAL / MISSING, after grounding against the CV text) and rates
 * three judgement-based dimensions 0–10. This module turns those into a
 * "profile-to-job match" from 0–100. It is NOT a probability of being hired.
 *
 * Dimensions and base weights (Σ = 100):
 *   requiredSkills   30  evidence  coverage of REQUIRED skill/tech/cert/other requirements
 *   preferredSkills  15  evidence  coverage of PREFERRED skill/tech/cert/other requirements
 *   experience       15  rating    AI rating vs. the stated experience requirement
 *   education        10  rating    AI rating vs. the stated education requirement
 *   projects         10  rating    AI rating of relevant project evidence
 *   technology       10  evidence  coverage of TECHNOLOGY requirements (any kind)
 *   keywordCoverage  10  evidence  share of job keywords found in the CV text (checked by code)
 *
 * Coverage = Σ credit × importance weight / Σ importance weight, where credit is
 * PRESENT 1, PARTIAL 0.5, MISSING 0 and importance is CRITICAL 2, IMPORTANT 1.5,
 * NICE_TO_HAVE 1.
 *
 * A dimension the job doesn't address (no preferred skills listed, no education
 * requirement, …) is "not applicable": it gets no score and its weight is
 * redistributed proportionally across the applicable ones, so candidates
 * aren't penalized for requirements that don't exist.
 */
export const SCORING_VERSION = 1;

export const MATCH_DIMENSIONS = [
  { key: "requiredSkills", label: "Required skills", weight: 30, basis: "evidence" },
  { key: "preferredSkills", label: "Preferred skills", weight: 15, basis: "evidence" },
  { key: "experience", label: "Experience", weight: 15, basis: "rating" },
  { key: "education", label: "Education", weight: 10, basis: "rating" },
  { key: "projects", label: "Projects", weight: 10, basis: "rating" },
  { key: "technology", label: "Technologies & tools", weight: 10, basis: "evidence" },
  { key: "keywordCoverage", label: "Keyword coverage", weight: 10, basis: "evidence" },
] as const;

export type MatchDimensionKey = (typeof MATCH_DIMENSIONS)[number]["key"];

const CREDIT = { PRESENT: 1, PARTIAL: 0.5, MISSING: 0 } as const;
const IMPORTANCE_WEIGHT = { CRITICAL: 2, IMPORTANT: 1.5, NICE_TO_HAVE: 1 } as const;
const SKILL_CATEGORIES = new Set(["SKILL", "TECHNOLOGY", "CERTIFICATION", "OTHER"]);

export type ScoringInput = {
  requirements: Pick<ReportRequirement, "kind" | "category" | "importance" | "match">[];
  ratings: { experience: number; education: number; projects: number };
  keywordCoverage: { matched: string[]; missing: string[] };
  /** Whether the job states an experience / education requirement at all. */
  hasExperienceRequirement: boolean;
  hasEducationRequirement: boolean;
};

type Coverage = { score: number; detail: string } | null;

/** Weighted coverage (0–100) of a set of requirements, or null if there are none. */
export function requirementCoverage(requirements: ScoringInput["requirements"]): Coverage {
  if (requirements.length === 0) return null;
  let earned = 0;
  let possible = 0;
  for (const r of requirements) {
    const weight = IMPORTANCE_WEIGHT[r.importance];
    earned += CREDIT[r.match] * weight;
    possible += weight;
  }
  const present = requirements.filter((r) => r.match === "PRESENT").length;
  const partial = requirements.filter((r) => r.match === "PARTIAL").length;
  return {
    score: Math.round((earned / possible) * 100),
    detail: `${present} found, ${partial} partial, ${requirements.length - present - partial} not found in your CV (of ${requirements.length})`,
  };
}

function clampRating(value: number) {
  return Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : 0;
}

export function computeMatchScore(input: ScoringInput) {
  const skillReqs = input.requirements.filter((r) => SKILL_CATEGORIES.has(r.category));
  const keywordsTotal = input.keywordCoverage.matched.length + input.keywordCoverage.missing.length;

  const raw: Record<MatchDimensionKey, Coverage> = {
    requiredSkills: requirementCoverage(skillReqs.filter((r) => r.kind === "REQUIRED")),
    preferredSkills: requirementCoverage(skillReqs.filter((r) => r.kind === "PREFERRED")),
    technology: requirementCoverage(input.requirements.filter((r) => r.category === "TECHNOLOGY")),
    experience: input.hasExperienceRequirement
      ? {
          score: clampRating(input.ratings.experience) * 10,
          detail: "Rated against the stated experience requirement",
        }
      : null,
    education: input.hasEducationRequirement
      ? {
          score: clampRating(input.ratings.education) * 10,
          detail: "Rated against the stated education requirement",
        }
      : null,
    projects: {
      score: clampRating(input.ratings.projects) * 10,
      detail: "Rated on project evidence relevant to this role",
    },
    keywordCoverage:
      keywordsTotal === 0
        ? null
        : {
            score: Math.round((input.keywordCoverage.matched.length / keywordsTotal) * 100),
            detail: `${input.keywordCoverage.matched.length} of ${keywordsTotal} job keywords appear in your CV`,
          },
  };

  const applicableWeight = MATCH_DIMENSIONS.filter((d) => raw[d.key] !== null).reduce(
    (sum, d) => sum + d.weight,
    0,
  );

  const dimensions = MATCH_DIMENSIONS.map((d) => {
    const value = raw[d.key];
    const effectiveWeight =
      value === null || applicableWeight === 0
        ? 0
        : Math.round((d.weight / applicableWeight) * 100 * 10) / 10;
    return {
      key: d.key,
      label: d.label,
      weight: d.weight,
      effectiveWeight,
      score: value?.score ?? null,
      basis: d.basis,
      detail: value?.detail ?? "Not applicable — the job description doesn't specify this",
    };
  });

  const overall =
    applicableWeight === 0
      ? 0
      : Math.round(
          MATCH_DIMENSIONS.reduce((sum, d) => {
            const value = raw[d.key];
            return value === null ? sum : sum + value.score * (d.weight / applicableWeight);
          }, 0),
        );

  return { version: SCORING_VERSION as typeof SCORING_VERSION, overall, dimensions };
}

/** Plain-language band. Deliberately avoids hiring-outcome language. */
export function matchBand(score: number): string {
  if (score >= 80) return "Strong alignment";
  if (score >= 65) return "Good alignment";
  if (score >= 45) return "Partial alignment";
  return "Limited alignment";
}
