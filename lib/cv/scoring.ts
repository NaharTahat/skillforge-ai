/**
 * CV SCORING METHODOLOGY (version 1)
 *
 * The AI never returns the overall score. It rates seven defined dimensions on
 * a 0–10 rubric, each with a rationale grounded in the CV. The overall score is
 * computed here as a weighted average scaled to 0–100:
 *
 *   overall = round( Σ (rating_d / 10) × weight_d ),   Σ weight_d = 100
 *
 * A dimension the CV doesn't address (e.g. no projects section) receives a low
 * rating by rubric — absence is scored, not ignored — and the rationale says so.
 * Changing weights or rubric text must bump SCORING_VERSION so stored reports
 * remain interpretable.
 */
export const SCORING_VERSION = 1;

export const SCORE_DIMENSIONS = [
  {
    key: "structure",
    label: "Structure",
    weight: 15,
    rubric: "Clear, conventional sections in a logical order; easy to scan.",
  },
  {
    key: "content",
    label: "Content quality",
    weight: 15,
    rubric: "Specific, results-oriented statements; quantified impact; no filler.",
  },
  {
    key: "skills",
    label: "Skills",
    weight: 15,
    rubric: "Relevant skills listed and backed by evidence in experience or projects.",
  },
  {
    key: "experience",
    label: "Experience",
    weight: 20,
    rubric: "Roles, responsibilities and achievements described with scope and outcomes.",
  },
  {
    key: "education",
    label: "Education",
    weight: 10,
    rubric: "Degrees, institutions, dates and relevant coursework or honours stated clearly.",
  },
  {
    key: "projects",
    label: "Projects",
    weight: 10,
    rubric: "Concrete projects with technologies used, the candidate's role and results.",
  },
  {
    key: "atsReadiness",
    label: "ATS readiness",
    weight: 15,
    rubric: "Machine-readable text, standard headings, contact details and role-relevant keywords.",
  },
] as const;

export type DimensionKey = (typeof SCORE_DIMENSIONS)[number]["key"];
export const DIMENSION_KEYS = SCORE_DIMENSIONS.map((d) => d.key) as [
  DimensionKey,
  ...DimensionKey[],
];

export type DimensionRatings = Record<DimensionKey, { rating: number; rationale: string }>;

export type ScoreBreakdown = {
  version: number;
  overall: number;
  dimensions: {
    key: DimensionKey;
    label: string;
    weight: number;
    rating: number;
    /** Points contributed to the overall score (rating/10 × weight). */
    points: number;
    rationale: string;
  }[];
};

function clampRating(value: number) {
  return Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : 0;
}

export function computeCvScore(ratings: DimensionRatings): ScoreBreakdown {
  const dimensions = SCORE_DIMENSIONS.map((d) => {
    const rating = clampRating(ratings[d.key].rating);
    return {
      key: d.key,
      label: d.label,
      weight: d.weight,
      rating,
      points: Math.round((rating / 10) * d.weight * 10) / 10,
      rationale: ratings[d.key].rationale,
    };
  });
  const overall = Math.round(
    SCORE_DIMENSIONS.reduce(
      (sum, d) => sum + (clampRating(ratings[d.key].rating) / 10) * d.weight,
      0,
    ),
  );
  return { version: SCORING_VERSION, overall, dimensions };
}

/** Rubric text given to the model, generated from the same definitions. */
export function scoringRubricForPrompt(): string {
  return SCORE_DIMENSIONS.map((d) => `- ${d.key} (${d.label}): ${d.rubric}`).join("\n");
}
