import type {
  AssessmentGenerationInput,
  OpenAnswerInput,
  ResultAnalysisInput,
} from "@/lib/ai/assessment";
import type { QuestionType } from "@/lib/assessment/constants";
import type { Slot } from "@/lib/assessment/plan";
import type { AnswerEvaluation, GeneratedQuestion, ResultAnalysis } from "@/lib/assessment/schema";

/**
 * Deterministic, rule-based stand-in for AI assessments (AI_PROVIDER=mock).
 * NOT an AI assessment; labelled as mock in the UI.
 *
 * Dev/test hook: a target title containing "[mock:ai-failure]" makes question
 * generation return invalid output, to exercise the provider-failure path.
 */
export const MOCK_FAILURE_MARKER = "[mock:ai-failure]";

type Objective = { question: string; options: string[]; correct: number };
type TrueFalse = { question: string; correct: boolean };
type Open = { scenario?: string; question: string; points: string[] };

const BANK: Record<string, { mc?: Objective[]; tf?: TrueFalse[] }> = {
  Python: {
    mc: [
      {
        question: "Which Python data structure provides average O(1) lookup by key?",
        options: ["List", "Tuple", "Dictionary", "Set"],
        correct: 2,
      },
      {
        question: "What does len([1, 2, 3]) return in Python?",
        options: ["2", "3", "4", "An error"],
        correct: 1,
      },
      {
        question: "Which keyword defines a function in Python?",
        options: ["func", "def", "function", "define"],
        correct: 1,
      },
    ],
    tf: [
      { question: "True or false: Python lists are mutable.", correct: true },
      {
        question: "True or false: a Python tuple can be changed after it is created.",
        correct: false,
      },
    ],
  },
  SQL: {
    mc: [
      {
        question: "Which SQL clause filters groups after aggregation?",
        options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"],
        correct: 1,
      },
      {
        question: "Which JOIN returns only rows that have matches in both tables?",
        options: ["LEFT JOIN", "INNER JOIN", "FULL OUTER JOIN", "CROSS JOIN"],
        correct: 1,
      },
    ],
    tf: [
      {
        question: "True or false: a PRIMARY KEY column can contain duplicate values.",
        correct: false,
      },
    ],
  },
};

/**
 * Generic templates for any catalog skill, one per aspect, so even a 20-question
 * single-skill assessment gets distinct questions of every type.
 */
const ASPECTS = [
  { name: "correctness", good: "Testing against known examples and edge cases" },
  { name: "debugging", good: "Reproducing the problem with a minimal example first" },
  { name: "testing", good: "Writing small, repeatable checks for each behaviour" },
  { name: "performance", good: "Measuring before optimizing the slowest part" },
  { name: "readability", good: "Using clear names and small, focused units" },
  { name: "security", good: "Validating inputs and following least privilege" },
  { name: "documentation", good: "Recording assumptions and decisions where others will look" },
  { name: "code review", good: "Asking a peer to review changes against clear criteria" },
  { name: "tooling", good: "Automating repeated steps with the standard tools" },
  { name: "edge cases", good: "Listing unusual inputs and handling each explicitly" },
  { name: "data handling", good: "Checking data quality before relying on results" },
  { name: "maintainability", good: "Keeping changes small and reversible" },
] as const;

const GENERIC_MC = (skill: string): Objective[] =>
  ASPECTS.map((a) => ({
    question: `When working with ${skill}, which practice best supports ${a.name}?`,
    options: [
      a.good,
      `Skipping ${a.name} to deliver faster`,
      `Leaving ${a.name} until the very end`,
      "Relying only on intuition",
    ],
    correct: 0,
  }));
const GENERIC_TF = (skill: string): TrueFalse[] =>
  ASPECTS.map((a, i) =>
    i % 2 === 0
      ? {
          question: `True or false: paying attention to ${a.name} early makes ${skill} work more reliable.`,
          correct: true,
        }
      : {
          question: `True or false: ${a.name} only matters after a ${skill} project is finished.`,
          correct: false,
        },
  );
const OPEN: Record<"SHORT_ANSWER" | "TECHNICAL" | "SCENARIO", (skill: string) => Open[]> = {
  SHORT_ANSWER: (skill) =>
    ASPECTS.map((a) => ({
      question: `Explain how you approach ${a.name} when working with ${skill}.`,
      points: [
        `Gives a specific practice for ${a.name}`,
        "Explains why it helps",
        `Mentions a concrete ${skill} example`,
      ],
    })),
  TECHNICAL: (skill) =>
    ASPECTS.map((a) => ({
      question: `Describe, step by step, how you would improve the ${a.name} of a small ${skill} solution. Code or pseudo-code is optional; it is read, not executed.`,
      points: [
        "Breaks the work into clear steps",
        `Uses appropriate ${skill} techniques`,
        "Explains how to verify the improvement",
      ],
    })),
  SCENARIO: (skill) =>
    ASPECTS.map((a) => ({
      scenario: `A ${skill} task is due tomorrow, and a reviewer has raised concerns about its ${a.name}.`,
      question: "What would you do, and in what order?",
      points: [
        "Clarifies the concern and its impact",
        `Proposes a concrete ${a.name} fix`,
        "Balances the fix against the deadline",
      ],
    })),
};

/** Rotates the correct option to a slot-dependent position so answers aren't always "A". */
function rotate(o: Objective, shift: number): { options: string[]; correct: number } {
  const n = o.options.length;
  const options = o.options.map((_, i) => o.options[(i + shift) % n]!);
  return { options, correct: (o.correct - shift + n * 10) % n };
}

function questionFor(slot: Slot, nth: number): GeneratedQuestion {
  const base = {
    slot: slot.index,
    type: slot.type,
    skill: slot.skill,
    difficulty: slot.difficulty,
  } as const;
  const empty = {
    scenario: null,
    options: null,
    correctOptionIndex: null,
    correctBoolean: null,
    expectedPoints: [],
  };
  const bank = BANK[slot.skill];
  switch (slot.type as QuestionType) {
    case "MULTIPLE_CHOICE": {
      const pool = [...(bank?.mc ?? []), ...GENERIC_MC(slot.skill)];
      const pick = pool[nth % pool.length]!;
      // Banked questions keep their order (stable for tests); generic ones rotate.
      const { options, correct } =
        nth < (bank?.mc?.length ?? 0)
          ? { options: pick.options, correct: pick.correct }
          : rotate(pick, slot.index);
      return {
        ...base,
        ...empty,
        question: pick.question,
        options,
        correctOptionIndex: correct,
        explanation: `The correct answer is "${options[correct]}".`,
      };
    }
    case "TRUE_FALSE": {
      const pool = [...(bank?.tf ?? []), ...GENERIC_TF(slot.skill)];
      const pick = pool[nth % pool.length]!;
      return {
        ...base,
        ...empty,
        question: pick.question,
        correctBoolean: pick.correct,
        explanation: `The statement is ${pick.correct ? "true" : "false"}.`,
      };
    }
    default: {
      const kind = slot.type as "SHORT_ANSWER" | "TECHNICAL" | "SCENARIO";
      const pool = OPEN[kind](slot.skill);
      const pick = pool[nth % pool.length]!;
      return {
        ...base,
        ...empty,
        scenario: pick.scenario ?? null,
        question: pick.question,
        expectedPoints: pick.points,
        explanation: `A strong answer covers: ${pick.points.join("; ")}.`,
      };
    }
  }
}

export function mockAssessmentQuestions(input: AssessmentGenerationInput): {
  questions: GeneratedQuestion[];
} {
  if (input.target.title.includes(MOCK_FAILURE_MARKER)) return { questions: [] };
  const counts = new Map<string, number>();
  return {
    questions: input.slots.map((slot) => {
      const key = `${slot.skill}|${slot.type}`;
      const nth = counts.get(key) ?? 0;
      counts.set(key, nth + 1);
      return questionFor(slot, nth);
    }),
  };
}

export function mockOpenEvaluation(input: OpenAnswerInput): AnswerEvaluation {
  const words = input.response.trim().split(/\s+/).filter(Boolean).length;
  const text = input.response.toLowerCase();
  const keywords = input.question.expectedPoints
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 5);
  const covered =
    keywords.length === 0 ? 0 : keywords.filter((k) => text.includes(k)).length / keywords.length;
  const bonus = covered >= 0.3 ? 1 : 0;
  if (words < 12) {
    return {
      accuracy: 3,
      relevance: 4 + bonus,
      completeness: 2,
      clarity: 5,
      technicalDepth: 2,
      feedback:
        "Mock evaluation: the answer is very short, so it covers few of the expected points.",
    };
  }
  if (words < 40) {
    return {
      accuracy: 6,
      relevance: 6 + bonus,
      completeness: 5,
      clarity: 6,
      technicalDepth: 5,
      feedback:
        "Mock evaluation: a reasonable answer that covers some expected points but leaves others out.",
    };
  }
  return {
    accuracy: 8,
    relevance: 8 + bonus,
    completeness: 8,
    clarity: 8,
    technicalDepth: 7,
    feedback: "Mock evaluation: a detailed answer that covers most of the expected points.",
  };
}

export function mockResultAnalysis(input: ResultAnalysisInput): ResultAnalysis {
  const strong = input.skills.filter((s) => s.level === "STRONG" || s.level === "COMPETENT");
  const weak = input.skills.filter(
    (s) => s.level === "DEVELOPING" || s.level === "NEEDS_IMPROVEMENT",
  );
  return {
    strengths: strong.map((s) => ({
      skill: s.skill,
      text: `Mock analysis: solid understanding of ${s.skill} on the questions in this assessment.`,
    })),
    improvementAreas: weak.map((s) => ({
      skill: s.skill,
      text: `Mock analysis: ${s.skill} needs more practice, especially the questions you missed.`,
    })),
    recommendations: weak.map((s) => ({
      skill: s.skill,
      text: `Revisit the explanations for the ${s.skill} questions you missed, then practice similar problems.`,
    })),
    reviewTopics: input.missed
      .slice(0, 6)
      .map((m) => ({ skill: m.skill, topic: m.prompt.slice(0, 180) })),
  };
}
