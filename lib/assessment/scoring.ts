import {
  CATEGORIES,
  CATEGORY_LABELS,
  QUESTION_CATEGORY,
  type PerformanceLevel,
  type QuestionType,
} from "./constants";
import type { CategoryScore, SkillScore } from "./schema";

/**
 * Deterministic assessment scoring. Every question is worth 1 point.
 *
 *  - Multiple choice / true-false: correct = 1, incorrect = 0 (graded on the server).
 *  - Open questions (short answer, scenario, technical): the evaluator rates
 *    accuracy, relevance, completeness, clarity and technical depth 0–10; the
 *    points are the weighted mean ÷ 10:
 *      accuracy 35 · completeness 20 · relevance 20 · technical depth 15 · clarity 10
 *  - Skipped or unanswered questions score 0.
 *
 * rawScore = Σ points (one decimal) · percentage = round(rawScore ÷ questions × 100)
 *
 * Levels (overall, per skill):
 *   ≥ 85 Strong · ≥ 70 Competent · ≥ 50 Developing · < 50 Needs improvement
 */

export const OPEN_WEIGHTS = {
  accuracy: 35,
  completeness: 20,
  relevance: 20,
  technicalDepth: 15,
  clarity: 10,
} as const;

export type OpenRatings = Record<keyof typeof OPEN_WEIGHTS, number>;

/** 0–1 points for an open answer, two decimals. */
export function openAnswerPoints(r: OpenRatings): number {
  let sum = 0;
  let weight = 0;
  for (const [dim, w] of Object.entries(OPEN_WEIGHTS) as [keyof OpenRatings, number][]) {
    sum += w * Math.min(10, Math.max(0, r[dim]));
    weight += w;
  }
  // Integer arithmetic until the final division avoids float drift (7.85 must round to 0.79, not 0.78).
  return Math.round((sum * 10) / weight) / 100;
}

/** Server-side grading of an objective answer. */
export function isCorrectObjective(
  type: QuestionType,
  correctAnswer: string | null,
  response: string,
): boolean {
  if (correctAnswer === null) return false;
  if (type === "TRUE_FALSE") return response.trim().toLowerCase() === correctAnswer;
  return response.trim() === correctAnswer;
}

export const LEVEL_THRESHOLDS: { min: number; level: PerformanceLevel }[] = [
  { min: 85, level: "STRONG" },
  { min: 70, level: "COMPETENT" },
  { min: 50, level: "DEVELOPING" },
  { min: 0, level: "NEEDS_IMPROVEMENT" },
];

export function levelFor(percentage: number): PerformanceLevel {
  return LEVEL_THRESHOLDS.find((t) => percentage >= t.min)!.level;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (score: number, max: number) => (max === 0 ? 0 : Math.round((score / max) * 100));

export type ScoredQuestion = {
  type: QuestionType;
  skill: string;
  /** 0–1 points; null when skipped/unanswered. */
  points: number | null;
};

export function computeScores(questions: ScoredQuestion[], skillOrder: string[]) {
  const pointsOf = (q: ScoredQuestion) => q.points ?? 0;
  const rawScore = round1(questions.reduce((s, q) => s + pointsOf(q), 0));
  const maxScore = questions.length;
  const percentage = pct(rawScore, maxScore);

  const skills: SkillScore[] = skillOrder
    .map((skill) => {
      const qs = questions.filter((q) => q.skill === skill);
      const score = round1(qs.reduce((s, q) => s + pointsOf(q), 0));
      const percentage = pct(score, qs.length);
      return {
        skill,
        score,
        max: qs.length,
        percentage,
        level: levelFor(percentage),
        questions: qs.length,
      };
    })
    .filter((s) => s.questions > 0);

  const categories: CategoryScore[] = CATEGORIES.map((category) => {
    const qs = questions.filter((q) => QUESTION_CATEGORY[q.type] === category);
    const score = round1(qs.reduce((s, q) => s + pointsOf(q), 0));
    return {
      category,
      label: CATEGORY_LABELS[category],
      score,
      max: qs.length,
      percentage: pct(score, qs.length),
      questions: qs.length,
    };
  }).filter((c) => c.questions > 0);

  return { rawScore, maxScore, percentage, level: levelFor(percentage), skills, categories };
}
