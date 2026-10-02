import type { Dimension, QuestionKind, Verdict } from "./constants";

/**
 * Deterministic interview scoring. The AI only rates dimensions 0–10; every
 * score shown to the user is computed here.
 *
 * Answer score (0–100) = weighted mean of the dimensions × 10:
 *   technical accuracy 25 · relevance 20 · completeness 20 · evidence 15 · clarity 10 · communication 10
 * Technical accuracy is excluded (and the weights renormalized) for questions
 * without technical content.
 */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  technicalAccuracy: 25,
  relevance: 20,
  completeness: 20,
  evidence: 15,
  clarity: 10,
  communication: 10,
};

export type Ratings = {
  technicalAccuracy: number | null;
  relevance: number;
  completeness: number;
  clarity: number;
  communication: number;
  evidence: number;
};

export function answerScore(r: Ratings): number {
  let sum = 0;
  let weight = 0;
  for (const [dim, w] of Object.entries(DIMENSION_WEIGHTS) as [Dimension, number][]) {
    const value = r[dim];
    if (value === null) continue;
    sum += w * value;
    weight += w;
  }
  return weight === 0 ? 0 : Math.round((sum / weight) * 10);
}

/**
 * Keeps the AI's verdict consistent with its own ratings:
 *  - "Strong" needs a score of at least 70, otherwise it is "Partial".
 *  - "Incorrect" needs a low technical-accuracy rating (≤ 5), otherwise it is "Partial".
 */
export function reconcileVerdict(verdict: Verdict, r: Ratings): Verdict {
  if (verdict === "STRONG" && answerScore(r) < 70) return "PARTIAL";
  if (verdict === "INCORRECT" && (r.technicalAccuracy === null || r.technicalAccuracy > 5)) {
    return "PARTIAL";
  }
  return verdict;
}

export type ScoredQuestion = {
  kind: QuestionKind;
  followUpIndex: number;
  status: "PENDING" | "ANSWERED" | "SKIPPED";
  answer:
    (Ratings & { score: number | null; status: "EVALUATING" | "EVALUATED" | "FAILED" }) | null;
};

const evaluated = (q: ScoredQuestion) =>
  q.status === "ANSWERED" && q.answer?.status === "EVALUATED" && q.answer.score !== null;

/**
 * Overall score: mean of every evaluated answer's score, with each skipped
 * primary question counting as 0. Skipped follow-ups are optional and ignored.
 */
export function overallScore(questions: ScoredQuestion[]): number {
  const scores = questions.filter(evaluated).map((q) => q.answer!.score!);
  const skippedPrimary = questions.filter(
    (q) => q.status === "SKIPPED" && q.followUpIndex === 0,
  ).length;
  const n = scores.length + skippedPrimary;
  return n === 0 ? 0 : Math.round(scores.reduce((s, x) => s + x, 0) / n);
}

/** A category is only scored with at least this many contributing answers. */
export const MIN_CATEGORY_EVIDENCE = 2;

const TECHNICAL_KINDS: QuestionKind[] = ["TECHNICAL", "PROJECT", "CV", "JOB", "GAP"];
const BEHAVIORAL_KINDS: QuestionKind[] = ["BEHAVIORAL", "HR"];
const JOB_KINDS: QuestionKind[] = ["JOB", "GAP"];

export type CategoryKey =
  "technical" | "behavioral" | "communication" | "problemSolving" | "jobAlignment";

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  communication: "Communication",
  problemSolving: "Problem solving",
  jobAlignment: "Job alignment",
};

/** Category scores (0–100). Only categories with enough evidence are returned. */
export function categoryScores(questions: ScoredQuestion[], isJobInterview: boolean) {
  const answers = questions.filter(evaluated);
  const mean = (values: number[]) =>
    Math.round((values.reduce((s, x) => s + x, 0) / values.length) * 10);

  const groups: { key: CategoryKey; values: number[] }[] = [
    {
      key: "technical",
      values: answers
        .filter((q) => TECHNICAL_KINDS.includes(q.kind) && q.answer!.technicalAccuracy !== null)
        .map((q) => q.answer!.technicalAccuracy!),
    },
    {
      key: "behavioral",
      values: answers
        .filter((q) => BEHAVIORAL_KINDS.includes(q.kind))
        .map((q) => q.answer!.score! / 10),
    },
    {
      key: "communication",
      values: answers.map((q) => (q.answer!.clarity + q.answer!.communication) / 2),
    },
    {
      key: "problemSolving",
      values: answers
        .filter((q) => TECHNICAL_KINDS.includes(q.kind))
        .map(
          (q) =>
            (q.answer!.completeness + (q.answer!.technicalAccuracy ?? q.answer!.completeness)) / 2,
        ),
    },
    {
      key: "jobAlignment",
      values: isJobInterview
        ? answers.filter((q) => JOB_KINDS.includes(q.kind)).map((q) => q.answer!.relevance)
        : [],
    },
  ];

  return groups
    .filter((g) => g.values.length >= MIN_CATEGORY_EVIDENCE)
    .map((g) => ({
      key: g.key,
      label: CATEGORY_LABELS[g.key],
      score: Math.min(100, Math.max(0, mean(g.values))),
      basedOn: g.values.length,
    }));
}

export function scoreBand(score: number): string {
  if (score >= 80) return "Strong performance";
  if (score >= 65) return "Solid performance";
  if (score >= 50) return "Developing";
  return "Needs more practice";
}
