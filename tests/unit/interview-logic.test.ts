import { describe, expect, it } from "vitest";
import {
  evaluateInterviewAnswer,
  generateInterviewQuestions,
  type AnswerEvaluationInput,
  type InterviewGenerationInput,
} from "@/lib/ai/interview";
import { mockAnswerEvaluation, mockInterviewQuestions } from "@/lib/ai/mock/interview";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AIProvider } from "@/lib/ai/types";
import { INTERVIEW_TYPES, QUESTION_COUNTS } from "@/lib/interview/constants";
import { defaultDifficulty, recommendedFocus } from "@/lib/interview/defaults";
import {
  groundQuestion,
  groundQuestions,
  KINDS_BY_TYPE,
  type GroundingContext,
} from "@/lib/interview/grounding";
import {
  currentQuestion,
  finishBlocker,
  interviewProgress,
  questionLabel,
} from "@/lib/interview/progress";
import { buildInterviewReport, type ReportQuestion } from "@/lib/interview/report";
import {
  answerEvaluationOutputSchema,
  interviewReportSchema,
  modelQuestionSchema,
  type AnswerEvaluationOutput,
  type ModelQuestion,
} from "@/lib/interview/schema";
import {
  answerScore,
  categoryScores,
  overallScore,
  reconcileVerdict,
  type ScoredQuestion,
} from "@/lib/interview/scoring";
import {
  answerBlocker,
  canAddFollowUp,
  canTransitionInterview,
  canTransitionQuestion,
} from "@/lib/interview/state";
import { createInterviewSchema, submitAnswerSchema } from "@/lib/interview/validation";

const CV = `Jane Doe
BSc Computer Science, University of Leeds, 2022
Skills: Python, SQL, Git
- Built a churn predictor in Python with scikit-learn and a REST API
- Wrote SQL reports for the finance team
Familiar with Docker from coursework`;

const JOB = `Machine Learning Engineer
Requirements: Strong Python skills. Experience with Kubernetes in production.
Nice to have: Experience with Docker.`;

const jobCtx: GroundingContext = {
  interviewSource: "JOB_MATCH",
  cvText: CV,
  jobText: JOB,
  jobRequirements: [
    { term: "Python", match: "PRESENT" },
    { term: "Kubernetes", match: "MISSING" },
    { term: "Docker", match: "PARTIAL" },
  ],
  roadmapSkills: ["Linux"],
  roadmapGapSkills: ["Linux"],
};
const careerCtx: GroundingContext = {
  ...jobCtx,
  interviewSource: "CAREER_GOAL",
  jobText: null,
  jobRequirements: [],
};

function mq(overrides: Partial<ModelQuestion> = {}): ModelQuestion {
  return {
    kind: "TECHNICAL",
    question: "How would you structure a Python service for model inference?",
    skill: "Python",
    source: "JOB_DESCRIPTION",
    sourceReason: "The position requires Python development.",
    sourceEvidence: "Strong Python skills.",
    ...overrides,
  };
}

const jobInput: InterviewGenerationInput = {
  source: "JOB_MATCH",
  target: { title: "Machine Learning Engineer", company: "Acme" },
  config: { type: "MIXED", difficulty: "INTERMEDIATE", focus: "MISSING_SKILLS", questionCount: 10 },
  experienceLevel: "Not specified",
  cvText: CV,
  cvTruncated: false,
  verifiedCvSkills: ["Python", "SQL", "Git"],
  job: {
    description: JOB,
    requirements: [
      {
        term: "Python",
        kind: "REQUIRED",
        importance: "CRITICAL",
        match: "PRESENT",
        evidenceFromJob: "Strong Python skills.",
      },
      {
        term: "Kubernetes",
        kind: "REQUIRED",
        importance: "CRITICAL",
        match: "MISSING",
        evidenceFromJob: "Experience with Kubernetes in production.",
      },
      {
        term: "Docker",
        kind: "PREFERRED",
        importance: "NICE_TO_HAVE",
        match: "PARTIAL",
        evidenceFromJob: "Experience with Docker.",
      },
    ],
    interviewTopics: ["Model deployment"],
  },
  roadmap: { gapSkills: ["Kubernetes"], taskSkills: ["Kubernetes", "Linux"] },
};
const careerInput: InterviewGenerationInput = {
  ...jobInput,
  source: "CAREER_GOAL",
  target: { title: "Data Scientist", company: null },
  config: { ...jobInput.config, focus: "TECHNICAL_DEPTH" },
  job: null,
  roadmap: null,
};

describe("interview schemas and input validation", () => {
  it("validates model questions and evaluations strictly", () => {
    expect(modelQuestionSchema.safeParse(mq()).success).toBe(true);
    expect(modelQuestionSchema.safeParse(mq({ kind: "TRIVIA" as never })).success).toBe(false);
    expect(modelQuestionSchema.safeParse(mq({ source: "INTERNET" as never })).success).toBe(false);
    expect(modelQuestionSchema.safeParse(mq({ question: "" })).success).toBe(false);
    const evaluation = mockAnswerEvaluation({
      question: {
        prompt: "Q",
        kind: "TECHNICAL",
        skill: "Python",
        source: "CV",
        sourceReason: "r",
        sourceEvidence: null,
        followUpIndex: 0,
      },
      answer: "short",
      target: "ML Engineer",
      difficulty: "ENTRY",
    });
    expect(answerEvaluationOutputSchema.safeParse(evaluation).success).toBe(true);
    expect(answerEvaluationOutputSchema.safeParse({ ...evaluation, relevance: 11 }).success).toBe(
      false,
    );
    expect(
      answerEvaluationOutputSchema.safeParse({ ...evaluation, verdict: "GREAT" }).success,
    ).toBe(false);
  });

  it("accepts valid sources and configuration only", () => {
    const config = { type: "MIXED", difficulty: "ENTRY", questionCount: "10", focus: "GENERAL" };
    expect(
      createInterviewSchema.parse({ source: "JOB_MATCH", jobId: "abc", ...config }),
    ).toMatchObject({
      questionCount: 10,
    });
    expect(
      createInterviewSchema.safeParse({ source: "CAREER_GOAL", cvId: "abc", ...config }).success,
    ).toBe(true);
    for (const bad of [
      { source: "ADMIN", jobId: "abc", ...config },
      { source: "JOB_MATCH", jobId: "../x", ...config },
      { source: "JOB_MATCH", jobId: "abc", ...config, questionCount: 7 },
      { source: "JOB_MATCH", jobId: "abc", ...config, type: "TRIVIA" },
      { source: "CAREER_GOAL", cvId: "abc", ...config, focus: "JOB_REQUIREMENTS" },
    ]) {
      expect(createInterviewSchema.safeParse(bad).success).toBe(false);
    }
    const smuggled = createInterviewSchema.parse({
      source: "JOB_MATCH",
      jobId: "abc",
      userId: "other",
      ...config,
    });
    expect(smuggled).not.toHaveProperty("userId");
  });

  it("bounds answers", () => {
    expect(submitAnswerSchema.safeParse({ questionId: "q1", answer: "  " }).success).toBe(false);
    expect(
      submitAnswerSchema.safeParse({ questionId: "q1", answer: "x".repeat(5001) }).success,
    ).toBe(false);
    expect(
      submitAnswerSchema.safeParse({ questionId: "q1", answer: "A real answer" }).success,
    ).toBe(true);
  });
});

describe("question grounding", () => {
  it("keeps questions traceable to the job description, Job Match or CV", () => {
    expect(groundQuestion(mq(), jobCtx)).toMatchObject({
      ok: true,
      question: { sourceEvidence: "Strong Python skills." },
    });
    expect(
      groundQuestion(mq({ source: "JOB_MATCH", skill: "Kubernetes", sourceEvidence: null }), jobCtx)
        .ok,
    ).toBe(true);
    expect(
      groundQuestion(mq({ source: "CV", skill: "SQL", sourceEvidence: null, kind: "CV" }), jobCtx)
        .ok,
    ).toBe(true);
  });

  it("rejects untraceable or disallowed sources", () => {
    expect(
      groundQuestion(
        mq({ source: "CV", skill: "Rust", sourceEvidence: "Led a Rust team" }),
        jobCtx,
      ),
    ).toEqual({
      ok: false,
      reason: "untraceable",
    });
    expect(
      groundQuestion(mq({ source: "JOB_MATCH", skill: "Scala", sourceEvidence: null }), jobCtx),
    ).toMatchObject({
      ok: false,
    });
    expect(groundQuestion(mq(), careerCtx)).toEqual({ ok: false, reason: "source_not_allowed" });
    expect(groundQuestion(mq({ source: "CAREER_GOAL" }), jobCtx)).toEqual({
      ok: false,
      reason: "source_not_allowed",
    });
    expect(groundQuestion(mq({ source: "GENERAL", kind: "TECHNICAL" }), jobCtx)).toEqual({
      ok: false,
      reason: "untraceable",
    });
    expect(groundQuestion(mq({ source: "ROADMAP", skill: "Terraform" }), jobCtx)).toEqual({
      ok: false,
      reason: "untraceable",
    });
  });

  it("drops a fabricated job quote but keeps a skill named in the job", () => {
    const result = groundQuestion(mq({ sourceEvidence: "10 years of Python required" }), jobCtx);
    expect(result).toMatchObject({ ok: true, question: { sourceEvidence: null } });
  });

  it("never invents projects", () => {
    expect(
      groundQuestion(
        mq({
          kind: "PROJECT",
          source: "CV",
          skill: null,
          sourceEvidence: "Built a self-driving car",
        }),
        jobCtx,
      ),
    ).toEqual({ ok: false, reason: "project_not_in_cv" });
    expect(
      groundQuestion(
        mq({
          kind: "PROJECT",
          source: "CV",
          skill: null,
          sourceEvidence: "Built a churn predictor in Python with scikit-learn",
        }),
        jobCtx,
      ).ok,
    ).toBe(true);
  });

  it("rejects wording that claims the candidate lacks a skill", () => {
    expect(
      groundQuestion(
        mq({
          question: "You don't know Kubernetes, so how would you learn it?",
          source: "JOB_MATCH",
          skill: "Kubernetes",
        }),
        jobCtx,
      ),
    ).toEqual({ ok: false, reason: "deficit_wording" });
  });

  it("treats GAP questions as gaps only for real gaps", () => {
    const gap = groundQuestion(
      mq({ kind: "GAP", source: "JOB_MATCH", skill: "Kubernetes", sourceEvidence: null }),
      jobCtx,
    );
    expect(gap).toMatchObject({ ok: true, question: { kind: "GAP" } });
    const notGap = groundQuestion(mq({ kind: "GAP" }), jobCtx);
    expect(notGap).toMatchObject({ ok: true, question: { kind: "TECHNICAL" } });
  });

  it("filters by interview type, removes duplicates and requires enough questions", () => {
    const behavioral = mq({
      kind: "BEHAVIORAL",
      source: "GENERAL",
      skill: null,
      sourceEvidence: null,
      question: "Tell me about a conflict.",
    });
    const result = groundQuestions([mq(), mq(), behavioral], jobCtx, "TECHNICAL", 1);
    expect(result.questions).toHaveLength(1);
    expect(result.rejected).toEqual({ duplicate: 1, kind_not_in_type: 1 });
    expect(groundQuestions([mq()], jobCtx, "TECHNICAL", 2).questions).toBeNull();
    expect(KINDS_BY_TYPE.HR_GENERAL).not.toContain("TECHNICAL");
  });
});

describe("scoring", () => {
  const ratings = {
    technicalAccuracy: 8,
    relevance: 9,
    completeness: 7,
    clarity: 8,
    communication: 8,
    evidence: 6,
  };

  it("computes a weighted answer score in code", () => {
    // (25·8 + 20·9 + 20·7 + 15·6 + 10·8 + 10·8) / 100 × 10 = 77
    expect(answerScore(ratings)).toBe(77);
    // Without technical accuracy the remaining weights are renormalized: 570 / 75 = 7.6 → 76.
    expect(answerScore({ ...ratings, technicalAccuracy: null })).toBe(76);
    expect(answerScore({ ...ratings, technicalAccuracy: 0 })).toBe(57);
  });

  it("keeps verdicts consistent with the ratings", () => {
    expect(reconcileVerdict("STRONG", { ...ratings, relevance: 2, completeness: 2 })).toBe(
      "PARTIAL",
    );
    expect(reconcileVerdict("INCORRECT", ratings)).toBe("PARTIAL");
    expect(reconcileVerdict("INCORRECT", { ...ratings, technicalAccuracy: 3 })).toBe("INCORRECT");
    expect(reconcileVerdict("WEAK_EVIDENCE", ratings)).toBe("WEAK_EVIDENCE");
  });

  const sq = (
    kind: ScoredQuestion["kind"],
    score: number | null,
    status: ScoredQuestion["status"] = "ANSWERED",
    followUpIndex = 0,
  ): ScoredQuestion => ({
    kind,
    followUpIndex,
    status,
    answer: score === null ? null : { ...ratings, score, status: "EVALUATED" },
  });

  it("averages answers and counts skipped primary questions as zero", () => {
    expect(
      overallScore([sq("TECHNICAL", 80), sq("BEHAVIORAL", 60), sq("TECHNICAL", null, "SKIPPED")]),
    ).toBe(47);
    // Skipped follow-ups are optional and ignored.
    expect(overallScore([sq("TECHNICAL", 80), sq("TECHNICAL", null, "SKIPPED", 1)])).toBe(80);
    expect(overallScore([])).toBe(0);
  });

  it("only scores categories with enough evidence", () => {
    const cats = categoryScores([sq("TECHNICAL", 80), sq("JOB", 70), sq("BEHAVIORAL", 60)], true);
    expect(cats.map((c) => c.key)).toEqual(["technical", "communication", "problemSolving"]);
    expect(
      categoryScores([sq("JOB", 80), sq("GAP", 70)], false).some((c) => c.key === "jobAlignment"),
    ).toBe(false);
    expect(
      categoryScores([sq("JOB", 80), sq("GAP", 70)], true).some((c) => c.key === "jobAlignment"),
    ).toBe(true);
  });
});

describe("progress and state", () => {
  const q = (
    id: string,
    position: number,
    status: "PENDING" | "ANSWERED" | "SKIPPED",
    followUpIndex = 0,
    answer: "EVALUATED" | "FAILED" | null = status === "ANSWERED" ? "EVALUATED" : null,
  ) => ({
    id,
    position,
    followUpIndex,
    status,
    answer: answer ? { status: answer } : null,
  });

  it("counts answered or skipped primary questions only", () => {
    const qs = [
      q("a", 1, "ANSWERED"),
      q("a1", 1, "PENDING", 1),
      q("b", 2, "SKIPPED"),
      q("c", 3, "ANSWERED"),
      q("d", 4, "ANSWERED"),
      ...[5, 6, 7, 8, 9, 10].map((n) => q(`x${n}`, n, "PENDING")),
    ];
    expect(interviewProgress(qs, 10)).toEqual({ resolved: 4, total: 10, percent: 40 });
    // The pending follow-up to question 1 comes before question 5.
    expect(currentQuestion(qs)?.id).toBe("a1");
    expect(finishBlocker(qs)).toBe("NOT_FINISHED");
    expect(finishBlocker([q("a", 1, "ANSWERED", 0, "FAILED")])).toBe("EVALUATIONS_PENDING");
    expect(finishBlocker([q("a", 1, "ANSWERED"), q("b", 2, "SKIPPED")])).toBeNull();
    expect(questionLabel({ position: 4, followUpIndex: 1 })).toBe("Question 4 · follow-up 1");
  });

  it("enforces the state machines", () => {
    expect(canTransitionInterview("DRAFT", "GENERATING")).toBe(true);
    expect(canTransitionInterview("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionInterview("FAILED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionInterview("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionQuestion("PENDING", "ANSWERED")).toBe(true);
    expect(canTransitionQuestion("ANSWERED", "PENDING")).toBe(false);
    expect(canTransitionQuestion("SKIPPED", "ANSWERED")).toBe(false);
    expect(answerBlocker("COMPLETED", "PENDING")).toBe("INTERVIEW_COMPLETED");
    expect(answerBlocker("GENERATING", "PENDING")).toBe("INTERVIEW_NOT_ACTIVE");
    expect(answerBlocker("IN_PROGRESS", "ANSWERED")).toBe("ALREADY_ANSWERED");
    expect(answerBlocker("IN_PROGRESS", "PENDING")).toBeNull();
  });

  it("allows at most two follow-ups per primary question", () => {
    expect(canAddFollowUp(0)).toBe(true);
    expect(canAddFollowUp(1)).toBe(true);
    expect(canAddFollowUp(2)).toBe(false);
  });
});

describe("defaults", () => {
  it("derives difficulty only from stated levels", () => {
    expect(defaultDifficulty("SENIOR", "STUDENT")).toEqual({
      difficulty: "ADVANCED",
      basis: "profile",
    });
    expect(defaultDifficulty(null, "MID")).toEqual({ difficulty: "INTERMEDIATE", basis: "cv" });
    expect(defaultDifficulty(null, "NOT_SPECIFIED")).toEqual({
      difficulty: "ENTRY",
      basis: "not_specified",
    });
  });
  it("recommends the highest-value focus", () => {
    expect(recommendedFocus([{ kind: "REQUIRED", match: "MISSING" }])).toBe("MISSING_SKILLS");
    expect(
      recommendedFocus([
        { kind: "PREFERRED", match: "MISSING" },
        { kind: "REQUIRED", match: "PRESENT" },
      ]),
    ).toBe("JOB_REQUIREMENTS");
  });
});

describe("final report", () => {
  const rq = (
    id: string,
    position: number,
    kind: ReportQuestion["kind"],
    skill: string | null,
    score: number | null,
    verdict: ReportQuestion["answer"] extends infer A
      ? A extends { verdict: infer V }
        ? V
        : never
      : never = "STRONG",
  ): ReportQuestion => ({
    id,
    position,
    followUpIndex: 0,
    kind,
    prompt: `Question about ${skill ?? "teamwork"}`,
    skill,
    status: score === null ? "SKIPPED" : "ANSWERED",
    answer:
      score === null
        ? null
        : {
            status: "EVALUATED",
            score,
            verdict,
            technicalAccuracy: kind === "BEHAVIORAL" ? null : score / 10,
            relevance: score / 10,
            completeness: score / 10,
            clarity: score / 10,
            communication: score / 10,
            evidence: score / 10,
            strengths: [`Clear on ${skill ?? "teamwork"}`],
            missingPoints: [`More detail on ${skill ?? "teamwork"}`],
          },
  });

  it("is deterministic, grounded in answers and links only real tasks", () => {
    const questions = [
      rq("q1", 1, "TECHNICAL", "Python", 85),
      rq("q2", 2, "GAP", "Kubernetes", 40, "WEAK_EVIDENCE"),
      rq("q3", 3, "BEHAVIORAL", null, 70),
      rq("q4", 4, "JOB", "Docker", null),
    ];
    const ctx = {
      isJobInterview: true,
      roadmapTasks: [
        {
          id: "t1",
          title: "Deploy the churn predictor on Kubernetes",
          skill: "Kubernetes",
          status: "AVAILABLE",
        },
        { id: "t2", title: "Learn Terraform", skill: "Terraform", status: "AVAILABLE" },
        { id: "t3", title: "Kubernetes basics", skill: "kubernetes", status: "COMPLETED" },
      ],
      jobRequirements: [
        { term: "Python", match: "PRESENT" as const },
        { term: "Kubernetes", match: "MISSING" as const },
        { term: "Docker", match: "PARTIAL" as const },
      ],
      cvSkills: ["Python", "SQL"],
    };
    const a = buildInterviewReport(questions, ctx);
    expect(buildInterviewReport(questions, ctx)).toEqual(a);
    expect(interviewReportSchema.safeParse(a).success).toBe(true);
    expect(a.overallScore).toBe(Math.round((85 + 40 + 70 + 0) / 4));
    expect(a.skipped).toBe(1);
    expect(a.questionsToReview.map((q) => q.questionId)).toEqual(["q4", "q2"]);
    expect(a.nextPractice.roadmapTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(a.nextPractice.jobGaps.map((g) => g.skill)).toEqual(["Kubernetes", "Docker"]);
    expect(a.nextPractice.cvSkills).toEqual(["Python"]);
    expect(a.strengths[0]).toEqual({ text: "Clear on Python", questionLabel: "Question 1" });
    expect(a.recommendations.some((r) => r.includes("skipped"))).toBe(true);
  });
});

describe("AI generation and evaluation (mock provider)", () => {
  it("is deterministic and grounded for every type and question count", async () => {
    expect(mockInterviewQuestions(jobInput)).toEqual(mockInterviewQuestions(jobInput));
    for (const input of [jobInput, careerInput]) {
      for (const type of INTERVIEW_TYPES) {
        for (const questionCount of QUESTION_COUNTS) {
          const result = await generateInterviewQuestions(
            { ...input, config: { ...input.config, type, questionCount } },
            new MockAIProvider(),
          );
          expect(result.questions).toHaveLength(questionCount);
          expect(result.questions.map((q) => q.position)).toEqual(
            Array.from({ length: questionCount }, (_, i) => i + 1),
          );
          expect(result.questions.every((q) => KINDS_BY_TYPE[type].includes(q.kind))).toBe(true);
          expect(result.questions.every((q) => q.sourceReason.length > 0)).toBe(true);
          expect(result.isMock).toBe(true);
        }
      }
    }
    const missing = await generateInterviewQuestions(jobInput, new MockAIProvider());
    expect(missing.questions[0]).toMatchObject({
      kind: "GAP",
      skill: "Kubernetes",
      source: "JOB_MATCH",
    });
    expect(missing.introduction).toContain("Machine Learning Engineer");
  });

  const evalInput = (
    answer: string,
    followUpIndex = 0,
    kind: AnswerEvaluationInput["question"]["kind"] = "TECHNICAL",
  ): AnswerEvaluationInput => ({
    question: {
      prompt: "How would you deploy a model with Kubernetes?",
      kind,
      skill: "Kubernetes",
      source: "JOB_MATCH",
      sourceReason: "r",
      sourceEvidence: null,
      followUpIndex,
    },
    answer,
    target: "ML Engineer",
    difficulty: "INTERMEDIATE",
  });

  it("evaluates answers with code-computed scores and limited follow-ups", async () => {
    const short = await evaluateInterviewAnswer(
      evalInput("I would use Kubernetes."),
      new MockAIProvider(),
    );
    expect(short.verdict).toBe("WEAK_EVIDENCE");
    expect(short.score).toBe(answerScore(short));
    expect(short.followUp).not.toBeNull();
    const second = await evaluateInterviewAnswer(
      evalInput("I would use Kubernetes.", 2),
      new MockAIProvider(),
    );
    expect(second.followUp).toBeNull();
    const long = await evaluateInterviewAnswer(
      evalInput(
        `I would deploy the model with Kubernetes ${"by containerizing it, adding health checks, configuring resources and rolling updates ".repeat(4)}`,
      ),
      new MockAIProvider(),
    );
    expect(long.verdict).toBe("STRONG");
    const behavioral = await evaluateInterviewAnswer(
      evalInput("Short answer here.", 0, "BEHAVIORAL"),
      new MockAIProvider(),
    );
    expect(behavioral.technicalAccuracy).toBeNull();
  });

  const fake = (data: unknown): AIProvider => ({
    name: "fake",
    isMock: false,
    generateStructured: async () => ({ ok: true, data: data as never, model: "m" }),
  });

  it("rejects unsafe feedback and invalid output", async () => {
    const base: AnswerEvaluationOutput = mockAnswerEvaluation(
      evalInput("A medium length answer about deploying containers with care and checks in place."),
    );
    await expect(
      evaluateInterviewAnswer(evalInput("x y"), fake({ ...base, feedback: "You are lazy." })),
    ).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    await expect(
      evaluateInterviewAnswer(evalInput("x y"), fake({ verdict: "STRONG" })),
    ).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    const cleaned = await evaluateInterviewAnswer(
      evalInput("x y"),
      fake({
        ...base,
        strengths: ["Good structure", "You don't know Kubernetes"],
        followUp: { question: "You lack Docker, right?", reason: "r" },
      }),
    );
    expect(cleaned.strengths).toEqual(["Good structure"]);
    expect(cleaned.followUp).toBeNull();
  });

  it("retries once when questions can't be traced, then fails safely", async () => {
    const untraceable = {
      questions: [mq({ source: "CV", skill: "Rust", sourceEvidence: null, kind: "CV" })],
    };
    let calls = 0;
    const flaky: AIProvider = {
      name: "fake",
      isMock: false,
      generateStructured: async () => {
        calls++;
        return {
          ok: true,
          data: (calls === 1 ? untraceable : { questions: [mq()] }) as never,
          model: "m",
        };
      },
    };
    const ok = await generateInterviewQuestions(
      { ...jobInput, config: { ...jobInput.config, type: "TECHNICAL", questionCount: 1 } },
      flaky,
    );
    expect(ok.questions).toHaveLength(1);
    expect(calls).toBe(2);
    await expect(
      generateInterviewQuestions(
        { ...jobInput, config: { ...jobInput.config, questionCount: 1 } },
        fake(untraceable),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  it("maps provider errors to safe codes", async () => {
    for (const [error, code] of [
      ["timeout", "AI_TIMEOUT"],
      ["rate_limited", "AI_RATE_LIMITED"],
      ["unavailable", "AI_UNAVAILABLE"],
      ["refused", "AI_REFUSED"],
      ["invalid_output", "AI_INVALID_OUTPUT"],
    ] as const) {
      const failing: AIProvider = {
        name: "fake",
        isMock: false,
        generateStructured: async () => ({ ok: false, error, message: "x" }),
      };
      await expect(generateInterviewQuestions(jobInput, failing)).rejects.toMatchObject({ code });
      await expect(evaluateInterviewAnswer(evalInput("x"), failing)).rejects.toMatchObject({
        code,
      });
    }
  });
});
