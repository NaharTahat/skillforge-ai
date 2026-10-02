import { z } from "zod";
import { CATEGORIES, LEVELS, PERFORMANCE_LEVELS, QUESTION_TYPES } from "./constants";

/**
 * Schemas:
 *  - generatedQuestionsSchema: what a provider must return for the planned slots.
 *  - answerEvaluationSchema: what a provider must return when rating one open answer.
 *  - resultAnalysisSchema: grounded insights a provider may write about real results.
 *  - stored result shapes (computed in code).
 * Model output is always validated and grounded before anything is saved.
 */

export const ASSESSMENT_VERSION = 1;

const text = (max: number) => z.string().trim().min(1).max(max);
const rating = z.number().int().min(0).max(10);

export const generatedQuestionSchema = z.object({
  /** The planned slot this question fills (0-based). */
  slot: z.number().int().min(0).max(39),
  type: z.enum(QUESTION_TYPES),
  skill: text(40),
  difficulty: z.enum(LEVELS),
  /** Scenario questions only: the situation; null otherwise. */
  scenario: z.string().trim().max(1200).nullable(),
  question: text(800),
  /** Multiple choice: 3–5 answer options; null otherwise. */
  options: z.array(text(200)).min(3).max(5).nullable(),
  /** Multiple choice: index of the correct option; null otherwise. */
  correctOptionIndex: z.number().int().min(0).max(4).nullable(),
  /** True/false: the correct answer; null otherwise. */
  correctBoolean: z.boolean().nullable(),
  /** Open questions: 2–6 points a complete answer covers; empty for objective questions. */
  expectedPoints: z.array(text(240)).max(6),
  explanation: text(800),
});

export const generatedQuestionsSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(40),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const answerEvaluationSchema = z.object({
  accuracy: rating,
  relevance: rating,
  completeness: rating,
  clarity: rating,
  technicalDepth: rating,
  /** Two to three neutral sentences about this answer only. */
  feedback: text(600),
});

export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;

const insight = z.object({ skill: z.string().trim().max(40).nullable(), text: text(300) });

export const resultAnalysisSchema = z.object({
  strengths: z.array(insight).max(6),
  improvementAreas: z.array(insight).max(6),
  recommendations: z.array(insight).max(6),
  reviewTopics: z.array(z.object({ skill: text(40), topic: text(200) })).max(8),
});

export type ResultAnalysis = z.infer<typeof resultAnalysisSchema>;
export type Insight = z.infer<typeof insight>;

/* ─── Stored result (computed in code) ─────────────────────────────────────── */

export const skillScoreSchema = z.object({
  skill: z.string(),
  score: z.number(),
  max: z.number().int(),
  percentage: z.number().int().min(0).max(100),
  level: z.enum(PERFORMANCE_LEVELS),
  questions: z.number().int(),
});

export const categoryScoreSchema = z.object({
  category: z.enum(CATEGORIES),
  label: z.string(),
  score: z.number(),
  max: z.number().int(),
  percentage: z.number().int().min(0).max(100),
  questions: z.number().int(),
});

export const storedInsightsSchema = z.object({
  strengths: z.array(insight),
  improvementAreas: z.array(insight),
  recommendations: z.array(insight),
  reviewTopics: z.array(z.object({ skill: z.string(), topic: z.string() })),
});

export type SkillScore = z.infer<typeof skillScoreSchema>;
export type CategoryScore = z.infer<typeof categoryScoreSchema>;
export type StoredInsights = z.infer<typeof storedInsightsSchema>;
