import { z } from "zod";
import { QUESTION_KINDS, QUESTION_SOURCES, VERDICTS } from "./constants";

/**
 * Schemas:
 *  - interviewQuestionsOutputSchema: what a provider must return when generating questions.
 *  - answerEvaluationOutputSchema: what a provider must return when evaluating one answer.
 *  - interviewReportSchema: the final report, computed in code and stored on the interview.
 * Model output is always validated, then grounded/normalized, before anything is saved.
 */

export const INTERVIEW_VERSION = 1;

const shortText = (max: number) => z.string().trim().min(1).max(max);
const rating = z.number().int().min(0).max(10);

export const modelQuestionSchema = z.object({
  kind: z.enum(QUESTION_KINDS),
  question: shortText(600),
  /** The skill or topic the question explores; null for general questions. */
  skill: z.string().trim().min(1).max(60).nullable(),
  source: z.enum(QUESTION_SOURCES),
  /** Why the question was selected, e.g. "The position requires Python development." */
  sourceReason: shortText(300),
  /** Verbatim quote from the CV or job description, when the source is one of them. */
  sourceEvidence: z.string().trim().max(300).nullable(),
});

/** The introduction is written in code from the real configuration, not by the model. */
export const interviewQuestionsOutputSchema = z.object({
  questions: z.array(modelQuestionSchema).min(1).max(24),
});

export type ModelQuestion = z.infer<typeof modelQuestionSchema>;
export type InterviewQuestionsOutput = z.infer<typeof interviewQuestionsOutputSchema>;

export const answerEvaluationOutputSchema = z.object({
  verdict: z.enum(VERDICTS),
  /** null for questions with no technical content (behavioral, HR). */
  technicalAccuracy: rating.nullable(),
  relevance: rating,
  completeness: rating,
  clarity: rating,
  communication: rating,
  evidence: rating,
  /** What the answer did well — must describe the answer itself. */
  strengths: z.array(shortText(240)).max(5),
  /** Important points the answer didn't cover. */
  missingPoints: z.array(shortText(240)).max(5),
  /** One or two sentences on technical accuracy; null when not applicable. */
  accuracyNote: z.string().trim().max(400).nullable(),
  /** One concrete, actionable suggestion. */
  improvement: shortText(400),
  /** Two to four neutral sentences. */
  feedback: shortText(800),
  /** A follow-up question only when it would genuinely help; otherwise null. */
  followUp: z.object({ question: shortText(500), reason: shortText(240) }).nullable(),
});

export type AnswerEvaluationOutput = z.infer<typeof answerEvaluationOutputSchema>;

const categorySchema = z.object({
  key: z.enum(["technical", "behavioral", "communication", "problemSolving", "jobAlignment"]),
  label: z.string(),
  /** 0–100, or null when there isn't enough evidence to score it. */
  score: z.number().int().min(0).max(100).nullable(),
  basedOn: z.number().int().min(0),
});

const questionRefSchema = z.object({
  questionId: z.string(),
  label: z.string(),
  prompt: z.string(),
  skill: z.string().nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  verdict: z.enum(VERDICTS).nullable(),
});

export const interviewReportSchema = z.object({
  reportVersion: z.literal(INTERVIEW_VERSION),
  overallScore: z.number().int().min(0).max(100),
  answered: z.number().int().min(0),
  skipped: z.number().int().min(0),
  total: z.number().int().min(0),
  categories: z.array(categorySchema),
  strengths: z.array(z.object({ text: z.string(), questionLabel: z.string() })),
  improvements: z.array(z.object({ text: z.string(), questionLabel: z.string() })),
  questionsToReview: z.array(questionRefSchema),
  recommendations: z.array(z.string()),
  nextPractice: z.object({
    roadmapTasks: z.array(
      z.object({ id: z.string(), title: z.string(), skill: z.string(), status: z.string() }),
    ),
    jobGaps: z.array(z.object({ skill: z.string(), match: z.enum(["PARTIAL", "MISSING"]) })),
    cvSkills: z.array(z.string()),
  }),
});

export type InterviewReport = z.infer<typeof interviewReportSchema>;
export type ReportCategory = z.infer<typeof categorySchema>;
