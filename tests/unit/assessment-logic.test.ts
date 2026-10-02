import { describe, expect, it } from "vitest";
import {
  evaluateOpenAnswer,
  generateAssessmentQuestions,
  type AssessmentGenerationInput,
} from "@/lib/ai/assessment";
import { MOCK_FAILURE_MARKER, mockAssessmentQuestions } from "@/lib/ai/mock/assessment";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AIProvider } from "@/lib/ai/types";
import {
  ASSESSMENT_TYPES,
  DIFFICULTIES,
  FOCUSES,
  QUESTION_COUNTS,
} from "@/lib/assessment/constants";
import { checkQuestion, groundQuestions } from "@/lib/assessment/grounding";
import {
  groundAnalysis,
  mergeRecommendations,
  roadmapRecommendations,
  ruleInsights,
} from "@/lib/assessment/insights";
import {
  buildPlan,
  questionDifficulty,
  typeCycle,
  type SkillContext,
  type Slot,
} from "@/lib/assessment/plan";
import type { GeneratedQuestion, SkillScore } from "@/lib/assessment/schema";
import {
  computeScores,
  isCorrectObjective,
  levelFor,
  openAnswerPoints,
} from "@/lib/assessment/scoring";
import { skillsInText, supportedSkill } from "@/lib/assessment/skills";
import {
  answerBlocker,
  assessmentProgress,
  canTransition,
  deadlineFrom,
  isPastDeadline,
} from "@/lib/assessment/state";
import { createAssessmentSchema, saveAnswerSchema } from "@/lib/assessment/validation";

const config = {
  type: "MIXED",
  difficulty: "ADAPTIVE",
  questionCount: "10",
  timeLimitMinutes: 30,
  focus: "MIXED",
};

describe("configuration", () => {
  it("accepts every valid source", () => {
    expect(
      createAssessmentSchema.parse({ source: "JOB_MATCH", jobId: "j1", ...config }),
    ).toMatchObject({ questionCount: 10, timeLimitMinutes: 30 });
    expect(
      createAssessmentSchema.safeParse({ source: "CAREER_GOAL", cvId: "c1", ...config }).success,
    ).toBe(true);
    expect(
      createAssessmentSchema.parse({ source: "SKILL", cvId: "c1", skills: ["python"], ...config }),
    ).toMatchObject({ skills: ["Python"] });
    expect(
      createAssessmentSchema.parse({
        source: "MIXED",
        cvId: "c1",
        skills: ["SQL", "Python"],
        ...config,
        timeLimitMinutes: "",
      }),
    ).toMatchObject({
      timeLimitMinutes: null,
    });
  });

  it("rejects invalid counts, difficulties, sources, skills and time limits", () => {
    for (const bad of [
      { source: "SKILL", cvId: "c1", skills: ["Python"], ...config, questionCount: 7 },
      { source: "SKILL", cvId: "c1", skills: ["Python"], ...config, difficulty: "EXPERT" },
      { source: "WEBSITE", cvId: "c1", ...config },
      { source: "SKILL", cvId: "c1", skills: ["COBOL"], ...config },
      { source: "SKILL", cvId: "c1", skills: ["Python", "SQL"], ...config },
      { source: "MIXED", cvId: "c1", skills: ["Python"], ...config },
      { source: "MIXED", cvId: "c1", skills: ["Python", "python"], ...config },
      { source: "SKILL", cvId: "c1", skills: ["Python"], ...config, timeLimitMinutes: 20 },
      { source: "JOB_MATCH", jobId: "../x", ...config },
    ]) {
      expect(createAssessmentSchema.safeParse(bad).success).toBe(false);
    }
    const smuggled = createAssessmentSchema.parse({
      source: "JOB_MATCH",
      jobId: "j1",
      userId: "someone",
      ...config,
    });
    expect(smuggled).not.toHaveProperty("userId");
    expect(saveAnswerSchema.safeParse({ questionId: "q1", response: " " }).success).toBe(false);
  });
});

describe("supported skills", () => {
  it("maps text onto the catalog without inventing skills", () => {
    expect(supportedSkill("machine learning")).toBe("Machine Learning");
    expect(supportedSkill("COBOL")).toBeNull();
    expect(skillsInText("3+ years of Python and PostgreSQL experience")).toEqual([
      "PostgreSQL",
      "Python",
    ]);
    expect(skillsInText("Bachelor's degree in Computer Science")).toEqual([]);
    expect(skillsInText("You will go to client sites")).toEqual([]);
  });
});

const ctx = (skill: string, evidence: SkillContext["evidence"] = "none"): SkillContext => ({
  skill,
  source: "SKILL_SELECTION",
  reason: `You selected ${skill}.`,
  evidence,
});

describe("question plan", () => {
  it("never reaches Advanced adaptively and respects a fixed choice", () => {
    expect(questionDifficulty("ADAPTIVE", "demonstrated", 0)).toBe("INTERMEDIATE");
    expect([0, 1].map((n) => questionDifficulty("ADAPTIVE", "partial", n))).toEqual([
      "BEGINNER",
      "INTERMEDIATE",
    ]);
    expect(questionDifficulty("ADAPTIVE", "none", 3)).toBe("BEGINNER");
    expect(questionDifficulty("ADVANCED", "none", 0)).toBe("ADVANCED");
    const plan = buildPlan([ctx("Python", "demonstrated"), ctx("SQL")], {
      type: "MIXED",
      focus: "MIXED",
      difficulty: "ADAPTIVE",
      questionCount: 20,
    });
    expect(plan.some((s) => s.difficulty === "ADVANCED")).toBe(false);
  });

  it("is deterministic and gives each skill a mix of question types", () => {
    const one = buildPlan([ctx("Python")], {
      type: "MIXED",
      focus: "MIXED",
      difficulty: "BEGINNER",
      questionCount: 6,
    });
    expect(new Set(one.map((s) => s.type)).size).toBe(5);
    const two = buildPlan([ctx("Python"), ctx("SQL")], {
      type: "MIXED",
      focus: "MIXED",
      difficulty: "BEGINNER",
      questionCount: 12,
    });
    expect(two).toEqual(
      buildPlan([ctx("Python"), ctx("SQL")], {
        type: "MIXED",
        focus: "MIXED",
        difficulty: "BEGINNER",
        questionCount: 12,
      }),
    );
    for (const skill of ["Python", "SQL"]) {
      expect(
        new Set(two.filter((s) => s.skill === skill).map((s) => s.type)).size,
      ).toBeGreaterThanOrEqual(3);
    }
    expect(two.filter((s) => s.skill === "Python")).toHaveLength(6);
    expect(typeCycle("PRACTICAL", "REAL_WORLD_SCENARIOS")[0]).toBe("SCENARIO");
    expect(typeCycle("CONCEPTUAL", "PROBLEM_SOLVING")).toEqual([
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "SHORT_ANSWER",
      "MULTIPLE_CHOICE",
    ]);
  });
});

const slot = (overrides: Partial<Slot> = {}): Slot => ({
  index: 0,
  skill: "Python",
  type: "MULTIPLE_CHOICE",
  difficulty: "BEGINNER",
  source: "SKILL_SELECTION",
  sourceReason: "You selected Python.",
  ...overrides,
});
const gq = (overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion => ({
  slot: 0,
  type: "MULTIPLE_CHOICE",
  skill: "Python",
  difficulty: "BEGINNER",
  scenario: null,
  question: "Which Python data structure provides average O(1) lookup by key?",
  options: ["List", "Tuple", "Dictionary", "Set"],
  correctOptionIndex: 2,
  correctBoolean: null,
  expectedPoints: [],
  explanation: "Dictionaries are hash tables.",
  ...overrides,
});

describe("question grounding", () => {
  it("accepts a valid question and attaches code-owned metadata", () => {
    const result = checkQuestion(gq(), slot());
    expect(result).toMatchObject({
      ok: true,
      question: {
        position: 1,
        correctAnswer: "c",
        source: "SKILL_SELECTION",
        sourceReason: "You selected Python.",
      },
    });
  });

  it("rejects slot mismatches, unsupported skills and invalid answer data", () => {
    expect(checkQuestion(gq({ difficulty: "ADVANCED" }), slot())).toEqual({
      ok: false,
      reason: "slot_mismatch",
    });
    expect(checkQuestion(gq({ skill: "COBOL" }), slot())).toEqual({
      ok: false,
      reason: "unsupported_skill",
    });
    expect(checkQuestion(gq({ options: ["A", "a", "B"] }), slot())).toEqual({
      ok: false,
      reason: "invalid_answer_data",
    });
    expect(checkQuestion(gq({ correctOptionIndex: 4 }), slot())).toEqual({
      ok: false,
      reason: "invalid_answer_data",
    });
    expect(
      checkQuestion(gq({ type: "TRUE_FALSE", options: null }), slot({ type: "TRUE_FALSE" })),
    ).toEqual({
      ok: false,
      reason: "invalid_answer_data",
    });
    expect(
      checkQuestion(
        gq({ type: "SHORT_ANSWER", options: null, expectedPoints: ["one"] }),
        slot({ type: "SHORT_ANSWER" }),
      ),
    ).toEqual({
      ok: false,
      reason: "invalid_answer_data",
    });
    expect(
      checkQuestion(
        gq({ type: "SCENARIO", options: null, expectedPoints: ["a", "b"] }),
        slot({ type: "SCENARIO" }),
      ),
    ).toEqual({ ok: false, reason: "invalid_answer_data" });
    expect(checkQuestion(gq(), undefined)).toEqual({ ok: false, reason: "unknown_slot" });
  });

  it("rejects questions that invent facts about the user", () => {
    expect(
      checkQuestion(
        gq({ question: "In your project at Google, which structure did you use?" }),
        slot(),
      ),
    ).toEqual({
      ok: false,
      reason: "personal_reference",
    });
  });

  it("removes duplicates and reports missing slots", () => {
    const slots = [slot(), slot({ index: 1 })];
    const result = groundQuestions([gq(), gq({ slot: 1 })], slots);
    expect(result.filled.size).toBe(1);
    expect(result.missing).toEqual([1]);
    expect(result.rejected).toEqual({ duplicate: 1 });
  });
});

describe("scoring", () => {
  it("grades objective answers on the server", () => {
    expect(isCorrectObjective("MULTIPLE_CHOICE", "c", "c")).toBe(true);
    expect(isCorrectObjective("MULTIPLE_CHOICE", "c", "a")).toBe(false);
    expect(isCorrectObjective("TRUE_FALSE", "true", "TRUE")).toBe(true);
    expect(isCorrectObjective("TRUE_FALSE", "false", "true")).toBe(false);
    expect(isCorrectObjective("MULTIPLE_CHOICE", null, "a")).toBe(false);
  });

  it("computes open-answer points deterministically", () => {
    // (35·8 + 20·7 + 20·9 + 15·7 + 10·8) / 100 = 7.85 → 0.79 points
    expect(
      openAnswerPoints({
        accuracy: 8,
        relevance: 9,
        completeness: 7,
        clarity: 8,
        technicalDepth: 7,
      }),
    ).toBe(0.79);
    expect(
      openAnswerPoints({
        accuracy: 0,
        relevance: 0,
        completeness: 0,
        clarity: 0,
        technicalDepth: 0,
      }),
    ).toBe(0);
  });

  it("computes raw score, percentage, skills and categories", () => {
    const scores = computeScores(
      [
        { type: "MULTIPLE_CHOICE", skill: "Python", points: 1 },
        { type: "MULTIPLE_CHOICE", skill: "Python", points: 0 },
        { type: "TRUE_FALSE", skill: "SQL", points: 1 },
        { type: "SHORT_ANSWER", skill: "SQL", points: 0.79 },
        { type: "SCENARIO", skill: "SQL", points: null },
      ],
      ["Python", "SQL", "Docker"],
    );
    expect(scores).toMatchObject({
      rawScore: 2.8,
      maxScore: 5,
      percentage: 56,
      level: "DEVELOPING",
    });
    expect(scores.skills.map((s) => [s.skill, s.percentage, s.level])).toEqual([
      ["Python", 50, "DEVELOPING"],
      ["SQL", 60, "DEVELOPING"],
    ]);
    expect(scores.categories.map((c) => [c.category, c.percentage])).toEqual([
      ["TECHNICAL_KNOWLEDGE", 50],
      ["PRACTICAL_APPLICATION", 0],
      ["CONCEPTS", 90],
    ]);
  });

  it("classifies with documented thresholds", () => {
    expect([85, 84, 70, 69, 50, 49, 0].map(levelFor)).toEqual([
      "STRONG",
      "COMPETENT",
      "COMPETENT",
      "DEVELOPING",
      "DEVELOPING",
      "NEEDS_IMPROVEMENT",
      "NEEDS_IMPROVEMENT",
    ]);
  });
});

describe("state and progress", () => {
  const started = new Date("2026-10-01T10:00:00Z");
  it("enforces the state machine and locking", () => {
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("EXPIRED", "COMPLETED")).toBe(false);
    const base = {
      status: "IN_PROGRESS" as const,
      startedAt: started,
      expiresAt: deadlineFrom(started, 15),
    };
    const during = new Date("2026-10-01T10:10:00Z");
    expect(answerBlocker(base, "PENDING", during)).toBeNull();
    expect(answerBlocker(base, "ANSWERED", during)).toBe("ALREADY_ANSWERED");
    expect(answerBlocker({ ...base, startedAt: null }, "PENDING", during)).toBe("NOT_STARTED");
    expect(answerBlocker({ ...base, status: "COMPLETED" }, "PENDING", during)).toBe(
      "ALREADY_FINISHED",
    );
    expect(answerBlocker(base, "PENDING", new Date("2026-10-01T10:16:00Z"))).toBe("EXPIRED");
  });

  it("allows a short grace period and no deadline without a time limit", () => {
    const deadline = deadlineFrom(started, 15)!;
    expect(isPastDeadline(deadline, new Date(deadline.getTime() + 20_000))).toBe(false);
    expect(isPastDeadline(deadline, new Date(deadline.getTime() + 31_000))).toBe(true);
    expect(deadlineFrom(started, null)).toBeNull();
    expect(isPastDeadline(null)).toBe(false);
    expect(
      assessmentProgress([
        { status: "ANSWERED" },
        { status: "PENDING" },
        { status: "ANSWERED" },
        { status: "SKIPPED" },
      ]),
    ).toEqual({
      answered: 2,
      total: 4,
      percent: 50,
    });
  });
});

const skillScore = (skill: string, percentage: number): SkillScore => ({
  skill,
  score: percentage / 100,
  max: 1,
  percentage,
  level: levelFor(percentage),
  questions: 1,
});

describe("insights and recommendations", () => {
  it("grounds AI insights to tested skills and strips statistics", () => {
    const grounded = groundAnalysis(
      {
        strengths: [
          { skill: "Python", text: "Strong grasp of Python data structures." },
          { skill: "Rust", text: "Great Rust ownership knowledge." },
          { skill: "Python", text: "Scored 90% on Python." },
        ],
        improvementAreas: [{ skill: "SQL", text: "Practice SQL joins." }],
        recommendations: [
          { skill: null, text: "This proves you are job ready and will be hired." },
        ],
        reviewTopics: [
          { skill: "SQL", topic: "GROUP BY and HAVING" },
          { skill: "Go", topic: "Goroutines" },
        ],
      },
      ["Python", "SQL"],
    );
    expect(grounded).toEqual({
      strengths: [{ skill: "Python", text: "Strong grasp of Python data structures." }],
      improvementAreas: [{ skill: "SQL", text: "Practice SQL joins." }],
      recommendations: [],
      reviewTopics: [{ skill: "SQL", topic: "GROUP BY and HAVING" }],
    });
    expect(
      groundAnalysis(
        { strengths: [], improvementAreas: [], recommendations: [], reviewTopics: [] },
        ["Python"],
      ),
    ).toBeNull();
  });

  it("links weak skills to real roadmap tasks without changing them", () => {
    const tasks = [
      { title: "Advanced Python Functions", skill: "Python", status: "AVAILABLE" },
      { title: "SQL basics", skill: "SQL", status: "COMPLETED" },
    ];
    const recs = roadmapRecommendations(
      [skillScore("Python", 62), skillScore("SQL", 40), skillScore("Git", 90)],
      tasks,
    );
    expect(recs).toEqual([
      {
        skill: "Python",
        text: "Review “Advanced Python Functions” in your Career Roadmap before continuing.",
      },
      {
        skill: "SQL",
        text: "SQL isn't in your roadmap yet — practice it with a short exercise, then retake a SQL assessment.",
      },
    ]);
    expect(tasks[0]!.status).toBe("AVAILABLE");
    expect(mergeRecommendations(recs, recs)).toHaveLength(2);
  });

  it("falls back to deterministic insights", () => {
    const a = ruleInsights(
      [skillScore("Python", 90), skillScore("SQL", 40)],
      [],
      [{ skill: "SQL", prompt: "Which clause filters groups?", points: 0 }],
    );
    expect(a).toEqual(
      ruleInsights(
        [skillScore("Python", 90), skillScore("SQL", 40)],
        [],
        [{ skill: "SQL", prompt: "Which clause filters groups?", points: 0 }],
      ),
    );
    expect(a.strengths[0]?.skill).toBe("Python");
    expect(a.improvementAreas[0]?.skill).toBe("SQL");
    expect(a.reviewTopics).toEqual([{ skill: "SQL", topic: "Which clause filters groups?" }]);
  });
});

const input = (overrides: Partial<AssessmentGenerationInput> = {}): AssessmentGenerationInput => {
  const skills = [ctx("Python", "demonstrated"), ctx("SQL", "partial"), ctx("Docker")];
  return {
    title: "Test assessment",
    target: { title: "Test assessment", company: null },
    type: "MIXED",
    focus: "MIXED",
    experienceLevel: "Not specified",
    skills,
    slots: buildPlan(skills, {
      type: "MIXED",
      focus: "MIXED",
      difficulty: "ADAPTIVE",
      questionCount: 10,
    }),
    ...overrides,
  };
};

describe("AI generation and evaluation (mock provider)", () => {
  it("fills every planned slot for every type, difficulty and count, deterministically", async () => {
    expect(mockAssessmentQuestions(input())).toEqual(mockAssessmentQuestions(input()));
    for (const type of ASSESSMENT_TYPES) {
      for (const difficulty of DIFFICULTIES) {
        for (const questionCount of QUESTION_COUNTS) {
          const skills = [ctx("Python", "demonstrated"), ctx("Machine Learning")];
          const slots = buildPlan(skills, { type, focus: "MIXED", difficulty, questionCount });
          const result = await generateAssessmentQuestions(
            input({ type, skills, slots }),
            new MockAIProvider(),
          );
          expect(result.questions).toHaveLength(questionCount);
          result.questions.forEach((q, i) => {
            expect([q.position, q.skill, q.type, q.difficulty]).toEqual([
              i + 1,
              slots[i]!.skill,
              slots[i]!.type,
              slots[i]!.difficulty,
            ]);
            expect(q.source).toBe("SKILL_SELECTION");
          });
        }
      }
    }
  });

  it("has enough distinct questions for the largest single-skill assessment with any type and focus", async () => {
    for (const type of ASSESSMENT_TYPES) {
      for (const focus of FOCUSES) {
        for (const skill of ["Python", "Kubernetes"]) {
          const skills = [ctx(skill)];
          const slots = buildPlan(skills, {
            type,
            focus,
            difficulty: "BEGINNER",
            questionCount: 20,
          });
          const result = await generateAssessmentQuestions(
            input({ type, focus, skills, slots }),
            new MockAIProvider(),
          );
          expect(result.questions).toHaveLength(20);
        }
      }
    }
  });

  it("fails safely on invalid output and maps provider errors", async () => {
    await expect(
      generateAssessmentQuestions(
        input({ target: { title: `Job ${MOCK_FAILURE_MARKER}`, company: null } }),
        new MockAIProvider(),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    for (const [error, code] of [
      ["timeout", "AI_TIMEOUT"],
      ["rate_limited", "AI_RATE_LIMITED"],
      ["unavailable", "AI_UNAVAILABLE"],
      ["refused", "AI_REFUSED"],
    ] as const) {
      const failing: AIProvider = {
        name: "f",
        isMock: false,
        generateStructured: async () => ({ ok: false, error, message: "x" }),
      };
      await expect(generateAssessmentQuestions(input(), failing)).rejects.toMatchObject({ code });
    }
  });

  it("asks again only for slots that came back invalid", async () => {
    const full = mockAssessmentQuestions(input());
    const asked: number[][] = [];
    const flaky: AIProvider = {
      name: "f",
      isMock: false,
      generateStructured: async (req) => {
        const slots = (req.input as AssessmentGenerationInput).slots.map((s) => s.index);
        asked.push(slots);
        const data =
          asked.length === 1
            ? { questions: full.questions.slice(0, 7) }
            : { questions: full.questions.filter((q) => slots.includes(q.slot)) };
        return { ok: true, data: data as never, model: "m" };
      },
    };
    const result = await generateAssessmentQuestions(input(), flaky);
    expect(result.questions).toHaveLength(10);
    expect(asked[1]).toEqual([7, 8, 9]);
  });

  const openInput = (response: string) => ({
    question: {
      type: "SHORT_ANSWER" as const,
      skill: "Python",
      difficulty: "BEGINNER" as const,
      scenario: null,
      prompt: "Explain list comprehensions.",
      expectedPoints: ["Syntax", "Readability"],
    },
    response,
  });

  it("rates open answers and computes points in code", async () => {
    const short = await evaluateOpenAnswer(openInput("A short answer."), new MockAIProvider());
    expect(short.points).toBe(openAnswerPoints(short));
    const long = await evaluateOpenAnswer(openInput("word ".repeat(60)), new MockAIProvider());
    expect(long.points).toBeGreaterThan(short.points);
    const fake = (data: unknown): AIProvider => ({
      name: "f",
      isMock: false,
      generateStructured: async () => ({ ok: true, data: data as never, model: "m" }),
    });
    await expect(evaluateOpenAnswer(openInput("x"), fake({ accuracy: 11 }))).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    await expect(
      evaluateOpenAnswer(
        openInput("x"),
        fake({
          accuracy: 5,
          relevance: 5,
          completeness: 5,
          clarity: 5,
          technicalDepth: 5,
          feedback: "You are lazy.",
        }),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    // An extra "score" from the AI is ignored; points always come from the ratings.
    const result = await evaluateOpenAnswer(
      openInput("x"),
      fake({
        accuracy: 5,
        relevance: 5,
        completeness: 5,
        clarity: 5,
        technicalDepth: 5,
        feedback: "Fine.",
        score: 100,
      }),
    );
    expect(result.points).toBe(0.5);
  });
});
