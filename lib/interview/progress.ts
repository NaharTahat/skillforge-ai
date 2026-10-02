import type { AnswerStatus, QuestionStatus } from "./constants";

type ProgressQuestion = {
  id: string;
  position: number;
  followUpIndex: number;
  status: QuestionStatus;
  answer: { status: AnswerStatus } | null;
};

export type InterviewProgress = {
  /** Primary questions answered or skipped. */
  resolved: number;
  total: number;
  /** 0–100, whole numbers. */
  percent: number;
};

/** Progress counts primary questions only: answered or skipped ÷ planned questions. */
export function interviewProgress(
  questions: ProgressQuestion[],
  questionCount: number,
): InterviewProgress {
  const resolved = questions.filter((q) => q.followUpIndex === 0 && q.status !== "PENDING").length;
  const total = Math.max(questionCount, 1);
  return { resolved, total: questionCount, percent: Math.round((resolved / total) * 100) };
}

export function orderQuestions<T extends ProgressQuestion>(questions: T[]): T[] {
  return [...questions].sort(
    (a, b) => a.position - b.position || a.followUpIndex - b.followUpIndex,
  );
}

/** The question to answer next: the first pending one in interview order. */
export function currentQuestion<T extends ProgressQuestion>(questions: T[]): T | null {
  return orderQuestions(questions).find((q) => q.status === "PENDING") ?? null;
}

/** The interview can be finished once nothing is pending and every answer has feedback. */
export function finishBlocker(
  questions: ProgressQuestion[],
): "NOT_FINISHED" | "EVALUATIONS_PENDING" | null {
  if (questions.some((q) => q.status === "PENDING")) return "NOT_FINISHED";
  if (questions.some((q) => q.status === "ANSWERED" && q.answer?.status !== "EVALUATED")) {
    return "EVALUATIONS_PENDING";
  }
  return null;
}

export function questionLabel(q: { position: number; followUpIndex: number }): string {
  return q.followUpIndex === 0
    ? `Question ${q.position}`
    : `Question ${q.position} · follow-up ${q.followUpIndex}`;
}
