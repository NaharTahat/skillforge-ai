import type {
  AssessmentType,
  Difficulty,
  Focus,
  QuestionLevel,
  QuestionSource,
  QuestionType,
} from "./constants";

/**
 * Deterministic question plan. Code decides every question's skill, type,
 * difficulty and source before any AI call; the AI only writes content for
 * these slots, and grounding checks it filled them exactly.
 */

/** How strongly the user's own data shows a skill. */
export type Evidence = "demonstrated" | "partial" | "none";

export type SkillContext = {
  skill: string;
  source: QuestionSource;
  /** Why this skill is in the assessment, e.g. "The job lists Python as required." */
  reason: string;
  evidence: Evidence;
};

export type Slot = {
  /** 0-based; position is index + 1. */
  index: number;
  skill: string;
  type: QuestionType;
  difficulty: QuestionLevel;
  source: QuestionSource;
  sourceReason: string;
};

/** Question types cycled for each assessment type. */
export const TYPE_CYCLES: Record<AssessmentType, readonly QuestionType[]> = {
  TECHNICAL: ["MULTIPLE_CHOICE", "TECHNICAL", "MULTIPLE_CHOICE", "SHORT_ANSWER", "TRUE_FALSE"],
  CONCEPTUAL: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "MULTIPLE_CHOICE"],
  PRACTICAL: ["SCENARIO", "TECHNICAL", "MULTIPLE_CHOICE", "SCENARIO"],
  MIXED: [
    "MULTIPLE_CHOICE",
    "SHORT_ANSWER",
    "TRUE_FALSE",
    "SCENARIO",
    "MULTIPLE_CHOICE",
    "TECHNICAL",
  ],
};

/** The question type each focus emphasises (moved to the front of the cycle when the type allows it). */
const FOCUS_TYPE: Record<Focus, QuestionType | null> = {
  CORE_CONCEPTS: "TRUE_FALSE",
  PROBLEM_SOLVING: "TECHNICAL",
  PRACTICAL_APPLICATION: "SCENARIO",
  TECHNICAL_KNOWLEDGE: "MULTIPLE_CHOICE",
  REAL_WORLD_SCENARIOS: "SCENARIO",
  MIXED: null,
};

export function typeCycle(type: AssessmentType, focus: Focus): QuestionType[] {
  const cycle = [...TYPE_CYCLES[type]];
  const preferred = FOCUS_TYPE[focus];
  // The focus type leads the cycle (so it appears more often); other types keep their place.
  return preferred && cycle.includes(preferred) ? [preferred, ...cycle] : cycle;
}

/**
 * Difficulty for the n-th question on a skill. A fixed choice applies to every
 * question. "Adaptive" follows the evidence, and never reaches Advanced from
 * the CV alone:
 *   demonstrated → Intermediate · partial → alternating Beginner/Intermediate · none → Beginner
 */
export function questionDifficulty(
  chosen: Difficulty,
  evidence: Evidence,
  nthOnSkill: number,
): QuestionLevel {
  if (chosen !== "ADAPTIVE") return chosen;
  if (evidence === "demonstrated") return "INTERMEDIATE";
  if (evidence === "partial") return nthOnSkill % 2 === 0 ? "BEGINNER" : "INTERMEDIATE";
  return "BEGINNER";
}

export function buildPlan(
  skills: SkillContext[],
  config: { type: AssessmentType; focus: Focus; difficulty: Difficulty; questionCount: number },
): Slot[] {
  if (skills.length === 0) return [];
  const cycle = typeCycle(config.type, config.focus);
  const perSkill = new Map<string, number>();
  return Array.from({ length: config.questionCount }, (_, index) => {
    // Types follow the cycle; the skill order shifts once per full cycle so every
    // skill gets a mix of question types even when the counts divide evenly.
    const ctx = skills[(index + Math.floor(index / cycle.length)) % skills.length]!;
    const n = perSkill.get(ctx.skill) ?? 0;
    perSkill.set(ctx.skill, n + 1);
    return {
      index,
      skill: ctx.skill,
      type: cycle[index % cycle.length]!,
      difficulty: questionDifficulty(config.difficulty, ctx.evidence, n),
      source: ctx.source,
      sourceReason: ctx.reason,
    };
  });
}
