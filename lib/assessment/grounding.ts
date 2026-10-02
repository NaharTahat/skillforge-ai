import { normalizeForMatch } from "@/lib/cv/grounding";
import type { QuestionLevel, QuestionSource, QuestionType } from "./constants";
import type { Slot } from "./plan";
import type { GeneratedQuestion } from "./schema";
import { supportedSkill } from "./skills";

/**
 * Question grounding and quality checks. A generated question is accepted only if:
 *  - it fills a planned slot exactly (same skill, type and difficulty) — so the
 *    skill is always a supported one and the source/reason come from code;
 *  - it has valid answer data for its type (3–5 distinct options with one correct
 *    index, a true/false key, or 2+ expected points; scenarios need a scenario);
 *  - it doesn't reference the candidate's own projects, employers, certificates,
 *    education or experience (questions test knowledge; nothing about the user is invented);
 *  - it isn't a duplicate of another question.
 */

export type GroundedQuestion = {
  position: number;
  type: QuestionType;
  skill: string;
  difficulty: QuestionLevel;
  scenario: string | null;
  prompt: string;
  options: { id: string; label: string }[] | null;
  /** Option id for multiple choice, "true" | "false" for true/false, null for open questions. */
  correctAnswer: string | null;
  expectedPoints: string[];
  explanation: string;
  source: QuestionSource;
  sourceReason: string;
};

export type RejectReason =
  | "unknown_slot"
  | "slot_mismatch"
  | "unsupported_skill"
  | "invalid_answer_data"
  | "personal_reference"
  | "duplicate";

const PERSONAL_REFERENCE =
  /\b(your (cv|resume|résumé|project|projects|employer|company|internship|certificat\w*|degree|university|previous (job|role)|experience at)|you (worked|studied|interned) at|you don't know|you lack)\b/i;

const OPTION_IDS = ["a", "b", "c", "d", "e"] as const;

export function checkQuestion(
  q: GeneratedQuestion,
  slot: Slot | undefined,
): { ok: true; question: GroundedQuestion } | { ok: false; reason: RejectReason } {
  if (!slot) return { ok: false, reason: "unknown_slot" };
  const skill = supportedSkill(q.skill);
  if (!skill) return { ok: false, reason: "unsupported_skill" };
  if (skill !== slot.skill || q.type !== slot.type || q.difficulty !== slot.difficulty) {
    return { ok: false, reason: "slot_mismatch" };
  }
  const allText = [q.scenario ?? "", q.question, q.explanation, ...(q.options ?? [])].join("\n");
  if (PERSONAL_REFERENCE.test(allText)) return { ok: false, reason: "personal_reference" };

  let options: GroundedQuestion["options"] = null;
  let correctAnswer: string | null = null;
  let expectedPoints: string[] = [];
  switch (q.type) {
    case "MULTIPLE_CHOICE": {
      const labels = q.options ?? [];
      const distinct = new Set(labels.map((l) => normalizeForMatch(l)));
      const index = q.correctOptionIndex;
      if (
        labels.length < 3 ||
        distinct.size !== labels.length ||
        index === null ||
        index >= labels.length
      ) {
        return { ok: false, reason: "invalid_answer_data" };
      }
      options = labels.map((label, i) => ({ id: OPTION_IDS[i]!, label: label.trim() }));
      correctAnswer = OPTION_IDS[index]!;
      break;
    }
    case "TRUE_FALSE":
      if (q.correctBoolean === null) return { ok: false, reason: "invalid_answer_data" };
      correctAnswer = q.correctBoolean ? "true" : "false";
      break;
    case "SCENARIO":
      if (!q.scenario?.trim()) return { ok: false, reason: "invalid_answer_data" };
    // falls through: scenarios are open questions too
    case "SHORT_ANSWER":
    case "TECHNICAL":
      expectedPoints = q.expectedPoints.map((p) => p.trim()).filter(Boolean);
      if (expectedPoints.length < 2) return { ok: false, reason: "invalid_answer_data" };
      break;
  }

  return {
    ok: true,
    question: {
      position: slot.index + 1,
      type: q.type,
      skill,
      difficulty: slot.difficulty,
      scenario: q.type === "SCENARIO" ? q.scenario!.trim() : null,
      prompt: q.question.trim(),
      options,
      correctAnswer,
      expectedPoints,
      explanation: q.explanation.trim(),
      source: slot.source,
      sourceReason: slot.sourceReason,
    },
  };
}

/**
 * Grounds generated questions against the plan. Returns the accepted
 * question for each filled slot and the slots still missing.
 */
export function groundQuestions(
  generated: GeneratedQuestion[],
  slots: Slot[],
  accepted = new Map<number, GroundedQuestion>(),
) {
  const filled = new Map(accepted);
  const seen = new Set(
    [...filled.values()].map((q) => normalizeForMatch(`${q.scenario ?? ""} ${q.prompt}`)),
  );
  const rejected: Partial<Record<RejectReason, number>> = {};
  const bySlot = new Map(slots.map((s) => [s.index, s]));
  for (const q of generated) {
    let reason: RejectReason | null = null;
    if (filled.has(q.slot)) reason = "duplicate";
    else {
      const result = checkQuestion(q, bySlot.get(q.slot));
      if (!result.ok) reason = result.reason;
      else {
        const key = normalizeForMatch(
          `${result.question.scenario ?? ""} ${result.question.prompt}`,
        );
        if (seen.has(key)) reason = "duplicate";
        else {
          seen.add(key);
          filled.set(q.slot, result.question);
        }
      }
    }
    if (reason) rejected[reason] = (rejected[reason] ?? 0) + 1;
  }
  return {
    filled,
    missing: slots.filter((s) => !filled.has(s.index)).map((s) => s.index),
    rejected,
  };
}
