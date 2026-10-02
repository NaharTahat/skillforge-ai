import { describe, expect, it } from "vitest";
import { analyzeJobMatch } from "@/lib/ai/job-matcher";
import { mockJobMatch } from "@/lib/ai/mock/job-match";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AIProvider, StructuredResult } from "@/lib/ai/types";
import { JobMatchError } from "@/lib/job-match/errors";
import { groundJobMatch } from "@/lib/job-match/grounding";
import {
  jobMatchModelOutputSchema,
  jobMatchReportSchema,
  type JobMatchModelOutput,
  type Requirement,
} from "@/lib/job-match/schema";
import { computeMatchScore, MATCH_DIMENSIONS, matchBand } from "@/lib/job-match/scoring";
import { jobMatchInputSchema, JOB_DESCRIPTION_MAX } from "@/lib/job-match/validation";

const CV = [
  "Jordan Rivera",
  "EXPERIENCE",
  "Data Analyst, Northwind Retail (2019 - 2024)",
  "- Built Python and SQL pipelines that cut weekly reporting time by 40%.",
  "- Containerized analytics jobs with Docker.",
  "EDUCATION",
  "BSc Computer Science, Lakeside University",
  "PROJECTS",
  "Churn predictor built with scikit-learn.",
].join("\n");

const JOB = [
  "Machine Learning Engineer",
  "Requirements:",
  "- 3+ years of Python experience",
  "- Strong SQL skills",
  "- Experience with Kubernetes in production",
  "- Bachelor's degree in Computer Science or similar",
  "Nice to have:",
  "- Docker",
  "- AWS",
].join("\n");

function req(overrides: Partial<Requirement>): Requirement {
  return {
    requirement: "Python",
    term: "Python",
    kind: "REQUIRED",
    category: "SKILL",
    importance: "IMPORTANT",
    evidenceFromJob: "3+ years of Python experience",
    match: "PRESENT",
    evidenceFromCv: "Built Python and SQL pipelines",
    explanation: "Shown in the CV.",
    ...overrides,
  };
}

function output(overrides: Partial<JobMatchModelOutput> = {}): JobMatchModelOutput {
  return {
    summary: "Solid alignment on data skills.",
    role: { title: "Machine Learning Engineer", seniority: "MID" },
    requirements: [req({})],
    responsibilities: [],
    experienceRequirement: { yearsMin: 3, description: "3+ years of Python experience" },
    educationRequirement: { description: "Bachelor's degree in Computer Science or similar" },
    keywords: ["Python", "SQL"],
    dimensions: {
      experience: { rating: 8, rationale: "Five years in data roles." },
      education: { rating: 9, rationale: "BSc Computer Science." },
      projects: { rating: 6, rationale: "One relevant project." },
    },
    strengths: [],
    recommendations: [],
    interviewTopics: [],
    ...overrides,
  };
}

const fakeProvider = (result: StructuredResult<unknown>): AIProvider => ({
  name: "fake",
  isMock: false,
  generateStructured: async () => result as never,
});

const aiInput = {
  cvText: CV,
  cvTruncated: false,
  job: { title: null, company: null, location: null, description: JOB },
};

describe("jobMatchInputSchema", () => {
  const valid = {
    cvId: "cmabc123",
    jobTitle: "",
    company: "",
    location: "",
    jobUrl: "",
    jobDescription: JOB + "\n" + "Responsibilities include building models.".repeat(2),
  };

  it("accepts a valid submission and normalizes empty optionals to null", () => {
    const parsed = jobMatchInputSchema.parse(valid);
    expect(parsed).toMatchObject({ jobTitle: null, company: null, jobUrl: null });
  });

  it("rejects too-short and too-long job descriptions", () => {
    expect(jobMatchInputSchema.safeParse({ ...valid, jobDescription: "Python dev" }).success).toBe(
      false,
    );
    expect(
      jobMatchInputSchema.safeParse({
        ...valid,
        jobDescription: "x".repeat(JOB_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it("measures length after cleaning, so whitespace padding doesn't pass", () => {
    expect(
      jobMatchInputSchema.safeParse({ ...valid, jobDescription: `${" ".repeat(200)}short` })
        .success,
    ).toBe(false);
  });

  it("strips control characters and normalizes line endings", () => {
    const parsed = jobMatchInputSchema.parse({
      ...valid,
      jobDescription: `${valid.jobDescription}\r\nEnd\u0000\u0007`,
    });
    expect(parsed.jobDescription.endsWith("\nEnd")).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://x.test", "not a url", "https://"])(
    "rejects unsafe job URL %s",
    (jobUrl) => {
      expect(jobMatchInputSchema.safeParse({ ...valid, jobUrl }).success).toBe(false);
    },
  );

  it("rejects malformed CV ids", () => {
    expect(jobMatchInputSchema.safeParse({ ...valid, cvId: "" }).success).toBe(false);
    expect(jobMatchInputSchema.safeParse({ ...valid, cvId: "../x" }).success).toBe(false);
  });
});

describe("jobMatchModelOutputSchema", () => {
  it("accepts well-formed output", () => {
    expect(jobMatchModelOutputSchema.safeParse(output()).success).toBe(true);
  });

  it.each([
    ["unknown match level", { requirements: [req({ match: "MAYBE" as never })] }],
    ["unknown kind", { requirements: [req({ kind: "OPTIONAL" as never })] }],
    [
      "rating above 10",
      { dimensions: { ...output().dimensions, projects: { rating: 11, rationale: "x" } } },
    ],
    ["too many requirements", { requirements: Array.from({ length: 41 }, () => req({})) }],
  ])("rejects %s", (_, overrides) => {
    expect(jobMatchModelOutputSchema.safeParse({ ...output(), ...overrides }).success).toBe(false);
  });
});

describe("computeMatchScore", () => {
  const base = {
    ratings: { experience: 10, education: 10, projects: 10 },
    keywordCoverage: { matched: ["a"], missing: [] },
    hasExperienceRequirement: true,
    hasEducationRequirement: true,
  };
  const r = (o: Partial<Requirement>) => ({ ...req(o) });

  it("base weights sum to 100", () => {
    expect(MATCH_DIMENSIONS.reduce((s, d) => s + d.weight, 0)).toBe(100);
  });

  it("scores 100 when everything is present", () => {
    const score = computeMatchScore({
      ...base,
      requirements: [
        r({ kind: "REQUIRED" }),
        r({ kind: "PREFERRED", term: "AWS" }),
        r({ category: "TECHNOLOGY", term: "Docker" }),
      ],
    });
    expect(score.overall).toBe(100);
  });

  it("gives half credit for PARTIAL and weights by importance", () => {
    const score = computeMatchScore({
      ...base,
      requirements: [
        r({ importance: "CRITICAL", match: "PRESENT" }), // weight 2, credit 1
        r({ importance: "NICE_TO_HAVE", match: "PARTIAL", term: "SQL" }), // weight 1, credit 0.5
      ],
    });
    const required = score.dimensions.find((d) => d.key === "requiredSkills")!;
    expect(required.score).toBe(83); // 2.5 / 3
  });

  it("skips non-applicable dimensions and redistributes their weight", () => {
    const score = computeMatchScore({
      ...base,
      hasEducationRequirement: false,
      keywordCoverage: { matched: [], missing: [] },
      requirements: [r({ kind: "REQUIRED", match: "MISSING" })],
    });
    const byKey = Object.fromEntries(score.dimensions.map((d) => [d.key, d]));
    expect(byKey.education!.score).toBeNull();
    expect(byKey.preferredSkills!.score).toBeNull();
    expect(byKey.technology!.score).toBeNull();
    expect(byKey.keywordCoverage!.score).toBeNull();
    // Applicable: required 30 (0), experience 15 (100), projects 10 (100) → 25/55.
    expect(score.overall).toBe(45);
    expect(byKey.requiredSkills!.effectiveWeight).toBeCloseTo(54.5, 1);
  });

  it("classifies requirements by kind and category", () => {
    const score = computeMatchScore({
      ...base,
      requirements: [
        r({ kind: "REQUIRED", match: "PRESENT" }),
        r({ kind: "PREFERRED", match: "MISSING", term: "AWS" }),
        // Experience/education requirements don't count as skills.
        r({ kind: "REQUIRED", category: "EXPERIENCE", match: "MISSING", term: "5 years" }),
      ],
    });
    const byKey = Object.fromEntries(score.dimensions.map((d) => [d.key, d]));
    expect(byKey.requiredSkills!.score).toBe(100);
    expect(byKey.preferredSkills!.score).toBe(0);
  });

  it("uses alignment wording, never hiring language", () => {
    for (const s of [95, 70, 50, 10]) {
      expect(matchBand(s)).toMatch(/alignment$/);
      expect(matchBand(s)).not.toMatch(/hire|job|chance/i);
    }
  });
});

describe("groundJobMatch", () => {
  it("drops requirements that aren't in the job description", () => {
    const g = groundJobMatch(
      output({
        requirements: [req({}), req({ term: "Rust", evidenceFromJob: "Expert Rust developer" })],
      }),
      CV,
      JOB,
    );
    expect(g.requirements.map((x) => x.term)).toEqual(["Python"]);
    expect(g.removedRequirements).toBe(1);
  });

  it("corrects unverifiable PRESENT claims", () => {
    const g = groundJobMatch(
      output({
        requirements: [
          // Fabricated CV quote, term absent from CV → MISSING.
          req({
            term: "Kubernetes",
            evidenceFromJob: "Experience with Kubernetes in production",
            evidenceFromCv: "Ran Kubernetes clusters",
          }),
          // Fabricated quote, but the term is in the CV → PARTIAL.
          req({ term: "SQL", evidenceFromJob: "Strong SQL skills", evidenceFromCv: "SQL expert" }),
        ],
      }),
      CV,
      JOB,
    );
    expect(g.requirements.map((x) => [x.term, x.match, x.evidenceFromCv, x.adjusted])).toEqual([
      ["Kubernetes", "MISSING", null, true],
      ["SQL", "PARTIAL", null, true],
    ]);
    expect(g.adjustedRequirements).toBe(2);
  });

  it("does not report a skill as missing when the CV mentions it", () => {
    const g = groundJobMatch(
      output({
        requirements: [
          req({
            term: "Docker",
            kind: "PREFERRED",
            evidenceFromJob: "Docker",
            match: "MISSING",
            evidenceFromCv: null,
          }),
          // Experience phrases aren't raised by term matching.
          req({
            term: "Python",
            category: "EXPERIENCE",
            evidenceFromJob: "3+ years of Python experience",
            match: "MISSING",
            evidenceFromCv: null,
          }),
        ],
      }),
      CV,
      JOB,
    );
    expect(g.requirements.map((x) => [x.term, x.match])).toEqual([
      ["Docker", "PARTIAL"],
      ["Python", "MISSING"],
    ]);
  });

  it("computes keyword coverage and ignores keywords absent from the job", () => {
    const g = groundJobMatch(
      output({ keywords: ["Python", "Kubernetes", "Blockchain", "python"] }),
      CV,
      JOB,
    );
    expect(g.keywordCoverage).toEqual({ matched: ["Python"], missing: ["Kubernetes"] });
  });
});

describe("analyzeJobMatch", () => {
  it("returns a validated report with an application-computed score", async () => {
    const outcome = await analyzeJobMatch(
      aiInput,
      fakeProvider({ ok: true, data: output(), model: "f" }),
    );
    expect(jobMatchReportSchema.safeParse(outcome.report).success).toBe(true);
    expect(outcome.report.score.overall).toBeGreaterThan(0);
    expect(outcome.isMock).toBe(false);
  });

  it("rejects an invalid AI response", async () => {
    const bad = { ...output(), requirements: [{ term: "x" }] };
    await expect(
      analyzeJobMatch(aiInput, fakeProvider({ ok: true, data: bad, model: "f" })),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });

  it.each([
    ["timeout", "AI_TIMEOUT"],
    ["unavailable", "AI_UNAVAILABLE"],
    ["rate_limited", "AI_RATE_LIMITED"],
    ["refused", "AI_REFUSED"],
  ] as const)("maps provider error %s to %s", async (error, code) => {
    const promise = analyzeJobMatch(aiInput, fakeProvider({ ok: false, error, message: "x" }));
    await expect(promise).rejects.toBeInstanceOf(JobMatchError);
    await expect(promise).rejects.toMatchObject({ code });
  });

  it("with the mock provider, detects missing skills and classifies preferred ones", async () => {
    const outcome = await analyzeJobMatch(aiInput, new MockAIProvider(0));
    const byTerm = Object.fromEntries(outcome.report.requirements.map((x) => [x.term, x]));
    expect(byTerm.Python).toMatchObject({ match: "PRESENT", kind: "REQUIRED" });
    expect(byTerm.Kubernetes).toMatchObject({ match: "MISSING", kind: "REQUIRED" });
    expect(byTerm.Docker).toMatchObject({ match: "PRESENT", kind: "PREFERRED" });
    expect(byTerm.AWS).toMatchObject({ match: "MISSING", kind: "PREFERRED" });
    expect(outcome.report.summary).toMatch(/not an AI assessment/);
    expect(outcome.isMock).toBe(true);
    expect(outcome.report.grounding.removedRequirements).toBe(0);
  });

  it("mock output is deterministic and schema-valid", () => {
    expect(mockJobMatch(CV, JOB)).toEqual(mockJobMatch(CV, JOB));
    expect(jobMatchModelOutputSchema.safeParse(mockJobMatch("x", JOB)).success).toBe(true);
  });
});
