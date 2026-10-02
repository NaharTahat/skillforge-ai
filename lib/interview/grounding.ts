import { evidenceAppearsIn, normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";
import { skillKey } from "@/lib/roadmap/prioritization";
import type { InterviewType, QuestionKind, QuestionSource } from "./constants";
import type { ModelQuestion } from "./schema";

/**
 * Question grounding. Every question must be traceable to a real source:
 *  - CV / CV_ANALYSIS: a verbatim CV quote, or the skill is named in the CV.
 *  - JOB_DESCRIPTION: a verbatim job-description quote, or the skill is named in it (job interviews only).
 *  - JOB_MATCH: the skill is one of the Job Match requirements (job interviews only).
 *  - ROADMAP: the skill is one of the roadmap's skill gaps or task skills.
 *  - CAREER_GOAL: role-typical topics (career-goal interviews only).
 *  - GENERAL: standard behavioral / HR questions only.
 * PROJECT questions additionally need a verbatim CV quote — projects are never invented.
 * Wording that claims the candidate lacks something is rejected.
 */

export type GroundingContext = {
  interviewSource: "JOB_MATCH" | "CAREER_GOAL";
  cvText: string;
  jobText: string | null;
  jobRequirements: { term: string; match: "PRESENT" | "PARTIAL" | "MISSING" }[];
  roadmapSkills: string[];
  /** Roadmap skill gaps (not demonstrated / developing). */
  roadmapGapSkills: string[];
};

export type GroundedQuestion = {
  kind: QuestionKind;
  prompt: string;
  skill: string | null;
  source: QuestionSource;
  sourceReason: string;
  sourceEvidence: string | null;
};

export type RejectReason =
  | "deficit_wording"
  | "source_not_allowed"
  | "untraceable"
  | "project_not_in_cv"
  | "kind_not_in_type"
  | "duplicate";

const DEFICIT_WORDING =
  /\b(you (do not|don't|did not|didn't|cannot|can't|never) (know|have|understand|use|used)|you lack|your lack of|you are not (able|qualified)|you're not (able|qualified))\b/i;

/** Question kinds that fit each interview type. */
export const KINDS_BY_TYPE: Record<InterviewType, readonly QuestionKind[]> = {
  TECHNICAL: ["TECHNICAL", "PROJECT", "CV", "JOB", "GAP"],
  BEHAVIORAL: ["BEHAVIORAL", "PROJECT"],
  HR_GENERAL: ["HR", "BEHAVIORAL"],
  MIXED: ["TECHNICAL", "BEHAVIORAL", "PROJECT", "CV", "JOB", "GAP", "HR"],
};

export function hasDeficitWording(text: string): boolean {
  return DEFICIT_WORDING.test(text);
}

export function groundQuestion(
  q: ModelQuestion,
  ctx: GroundingContext,
): { ok: true; question: GroundedQuestion } | { ok: false; reason: RejectReason } {
  if (hasDeficitWording(q.question) || hasDeficitWording(q.sourceReason)) {
    return { ok: false, reason: "deficit_wording" };
  }
  const cv = normalizeForMatch(ctx.cvText);
  const job = ctx.jobText === null ? null : normalizeForMatch(ctx.jobText);
  const skill = q.skill?.trim() || null;
  const quote = q.sourceEvidence?.trim() || null;
  const cvQuoteOk = quote !== null && evidenceAppearsIn(quote, cv);
  const jobQuoteOk = quote !== null && job !== null && evidenceAppearsIn(quote, job);
  const isJob = ctx.interviewSource === "JOB_MATCH";

  // Projects must come from the CV itself — never invented.
  if (q.kind === "PROJECT" && !cvQuoteOk) return { ok: false, reason: "project_not_in_cv" };

  let evidence: string | null = null;
  switch (q.source) {
    case "CV":
    case "CV_ANALYSIS":
      if (!cvQuoteOk && !(skill && termAppearsIn(skill, cv)))
        return { ok: false, reason: "untraceable" };
      evidence = cvQuoteOk ? quote : null;
      break;
    case "JOB_DESCRIPTION":
      if (!isJob || job === null) return { ok: false, reason: "source_not_allowed" };
      if (!jobQuoteOk && !(skill && termAppearsIn(skill, job)))
        return { ok: false, reason: "untraceable" };
      evidence = jobQuoteOk ? quote : null;
      break;
    case "JOB_MATCH": {
      if (!isJob) return { ok: false, reason: "source_not_allowed" };
      const terms = new Set(ctx.jobRequirements.map((r) => skillKey(r.term)));
      if (!(skill && terms.has(skillKey(skill))) && !jobQuoteOk)
        return { ok: false, reason: "untraceable" };
      evidence = jobQuoteOk ? quote : null;
      break;
    }
    case "ROADMAP": {
      const skills = new Set(ctx.roadmapSkills.map(skillKey));
      if (!(skill && skills.has(skillKey(skill)))) return { ok: false, reason: "untraceable" };
      break;
    }
    case "CAREER_GOAL":
      if (isJob) return { ok: false, reason: "source_not_allowed" };
      if (!skill && q.kind !== "BEHAVIORAL" && q.kind !== "HR")
        return { ok: false, reason: "untraceable" };
      break;
    case "GENERAL":
      if (q.kind !== "BEHAVIORAL" && q.kind !== "HR") return { ok: false, reason: "untraceable" };
      break;
  }

  if (q.kind === "PROJECT") evidence = quote;

  // A "skill exploration" question must target a real gap; otherwise it is a plain technical question.
  let kind = q.kind;
  if (kind === "GAP" && !isGapSkill(skill, ctx)) kind = "TECHNICAL";

  return {
    ok: true,
    question: {
      kind,
      prompt: q.question.trim(),
      skill,
      source: q.source,
      sourceReason: q.sourceReason.trim(),
      sourceEvidence: evidence,
    },
  };
}

function isGapSkill(skill: string | null, ctx: GroundingContext): boolean {
  if (!skill) return false;
  const key = skillKey(skill);
  if (ctx.jobRequirements.some((r) => r.match !== "PRESENT" && skillKey(r.term) === key))
    return true;
  if (ctx.roadmapGapSkills.some((s) => skillKey(s) === key)) return true;
  // Career-goal interviews: a role skill the CV doesn't name.
  return (
    ctx.interviewSource === "CAREER_GOAL" && !termAppearsIn(skill, normalizeForMatch(ctx.cvText))
  );
}

/**
 * Grounds every question, drops those that don't fit the interview type and
 * duplicates, then keeps the first `count`. Returns null when too few remain.
 */
export function groundQuestions(
  questions: ModelQuestion[],
  ctx: GroundingContext,
  type: InterviewType,
  count: number,
) {
  const kept: GroundedQuestion[] = [];
  const rejected: Partial<Record<RejectReason, number>> = {};
  const seen = new Set<string>();
  for (const q of questions) {
    const result = groundQuestion(q, ctx);
    let reason: RejectReason | null = result.ok ? null : result.reason;
    if (result.ok) {
      const key = normalizeForMatch(result.question.prompt);
      if (!KINDS_BY_TYPE[type].includes(result.question.kind)) reason = "kind_not_in_type";
      else if (seen.has(key)) reason = "duplicate";
      else {
        seen.add(key);
        kept.push(result.question);
      }
    }
    if (reason) rejected[reason] = (rejected[reason] ?? 0) + 1;
  }
  return {
    questions: kept.length >= count ? kept.slice(0, count) : null,
    available: kept.length,
    rejected,
  };
}
