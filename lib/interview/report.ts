import { skillKey } from "@/lib/roadmap/prioritization";
import type { QuestionKind, Verdict } from "./constants";
import { orderQuestions, questionLabel } from "./progress";
import { INTERVIEW_VERSION, interviewReportSchema, type InterviewReport } from "./schema";
import { categoryScores, overallScore, type Ratings } from "./scoring";

/**
 * Builds the final report deterministically from stored evaluations — no AI
 * call. Strengths and improvements are the evaluator's per-answer notes;
 * "Next practice" links only to real roadmap tasks, Job Match gaps and CV skills.
 */

export type ReportQuestion = {
  id: string;
  position: number;
  followUpIndex: number;
  kind: QuestionKind;
  prompt: string;
  skill: string | null;
  status: "PENDING" | "ANSWERED" | "SKIPPED";
  answer:
    | (Ratings & {
        status: "EVALUATING" | "EVALUATED" | "FAILED";
        score: number | null;
        verdict: Verdict | null;
        strengths: string[];
        missingPoints: string[];
      })
    | null;
};

export type ReportContext = {
  isJobInterview: boolean;
  roadmapTasks: { id: string; title: string; skill: string; status: string }[];
  jobRequirements: { term: string; match: "PRESENT" | "PARTIAL" | "MISSING" }[];
  cvSkills: string[];
};

const MAX_LIST = 6;

function uniqueByText<T extends { text: string }>(items: T[], max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);

export function buildInterviewReport(
  questionsIn: ReportQuestion[],
  ctx: ReportContext,
): InterviewReport {
  const questions = orderQuestions(questionsIn);
  const evaluated = questions.filter(
    (q) => q.status === "ANSWERED" && q.answer?.status === "EVALUATED" && q.answer.score !== null,
  );
  const skippedPrimary = questions.filter((q) => q.status === "SKIPPED" && q.followUpIndex === 0);

  const strengths = uniqueByText(
    evaluated
      .filter((q) => q.answer!.score! >= 60)
      .sort((a, b) => b.answer!.score! - a.answer!.score!)
      .flatMap((q) =>
        q.answer!.strengths.map((text) => ({ text, questionLabel: questionLabel(q) })),
      ),
    MAX_LIST,
  );

  const improvements = uniqueByText(
    evaluated
      .filter((q) => q.answer!.score! < 75 || q.answer!.verdict !== "STRONG")
      .sort((a, b) => a.answer!.score! - b.answer!.score!)
      .flatMap((q) =>
        q.answer!.missingPoints.map((text) => ({ text, questionLabel: questionLabel(q) })),
      ),
    MAX_LIST,
  );

  const review = [
    ...evaluated.filter(
      (q) =>
        q.answer!.score! < 60 || (q.answer!.verdict !== null && q.answer!.verdict !== "STRONG"),
    ),
    ...skippedPrimary,
  ]
    .sort((a, b) => (a.answer?.score ?? -1) - (b.answer?.score ?? -1))
    .slice(0, 8);

  const weakSkills = new Set(
    review
      .map((q) => q.skill)
      .filter((s): s is string => !!s)
      .map(skillKey),
  );
  const strongSkills = new Set(
    evaluated.filter((q) => q.answer!.score! >= 70 && q.skill).map((q) => skillKey(q.skill!)),
  );

  // Practical, rule-based recommendations from the dimension averages.
  const avg = (dim: keyof Ratings) =>
    mean(evaluated.map((q) => q.answer![dim]).filter((v): v is number => v !== null));
  const recommendations: string[] = [];
  const evidenceAvg = avg("evidence");
  const clarityAvg = mean(evaluated.map((q) => (q.answer!.clarity + q.answer!.communication) / 2));
  const completenessAvg = avg("completeness");
  const technicalAvg = avg("technicalAccuracy");
  if (evidenceAvg !== null && evidenceAvg < 6) {
    recommendations.push(
      "Back up each answer with a specific example: the situation, what you did, and the measurable result (the STAR method).",
    );
  }
  if (clarityAvg !== null && clarityAvg < 6) {
    recommendations.push(
      "Structure your answers: state the main point first, then explain your reasoning, and finish with the outcome.",
    );
  }
  if (completenessAvg !== null && completenessAvg < 6) {
    recommendations.push(
      "Before answering, note the parts of the question and make sure your answer covers each one.",
    );
  }
  const weakTechnical = review
    .filter(
      (q) =>
        q.skill &&
        q.answer?.technicalAccuracy !== null &&
        q.answer?.technicalAccuracy !== undefined,
    )
    .map((q) => q.skill!);
  if (technicalAvg !== null && technicalAvg < 6 && weakTechnical.length > 0) {
    recommendations.push(
      `Review the fundamentals of ${[...new Set(weakTechnical)].slice(0, 3).join(", ")} and practice explaining them out loud.`,
    );
  }
  for (const skill of [
    ...new Set(review.map((q) => q.skill).filter((s): s is string => !!s)),
  ].slice(0, 3)) {
    recommendations.push(
      `Practice explaining ${skill} with a concrete example from your own work or studies.`,
    );
  }
  if (skippedPrimary.length > 0) {
    recommendations.push(
      `Revisit the ${skippedPrimary.length} skipped question${skippedPrimary.length === 1 ? "" : "s"} — even a short, honest answer is useful practice.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Keep practicing at a higher difficulty or with a different focus to stretch further.",
    );
  }

  const report: InterviewReport = {
    reportVersion: INTERVIEW_VERSION,
    overallScore: overallScore(questions),
    answered: questions.filter((q) => q.status === "ANSWERED").length,
    skipped: questions.filter((q) => q.status === "SKIPPED").length,
    total: questions.length,
    categories: categoryScores(questions, ctx.isJobInterview),
    strengths,
    improvements,
    questionsToReview: review.map((q) => ({
      questionId: q.id,
      label: questionLabel(q),
      prompt: q.prompt,
      skill: q.skill,
      score: q.answer?.score ?? null,
      verdict: q.answer?.verdict ?? null,
    })),
    recommendations: [...new Set(recommendations)].slice(0, 8),
    nextPractice: {
      roadmapTasks: ctx.roadmapTasks
        .filter((t) => t.status !== "COMPLETED" && weakSkills.has(skillKey(t.skill)))
        .slice(0, 5),
      jobGaps: ctx.jobRequirements
        .filter((r): r is { term: string; match: "PARTIAL" | "MISSING" } => r.match !== "PRESENT")
        .sort(
          (a, b) =>
            Number(weakSkills.has(skillKey(b.term))) - Number(weakSkills.has(skillKey(a.term))),
        )
        .slice(0, MAX_LIST)
        .map((r) => ({ skill: r.term, match: r.match })),
      cvSkills: ctx.cvSkills.filter((s) => strongSkills.has(skillKey(s))).slice(0, MAX_LIST),
    },
  };
  return interviewReportSchema.parse(report);
}
