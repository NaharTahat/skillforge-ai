import { describe, expect, it } from "vitest";
import { analyzeCv } from "@/lib/ai/cv-analyzer";
import { mockCvAnalysis } from "@/lib/ai/mock/cv-analysis";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AIProvider, StructuredResult } from "@/lib/ai/types";
import {
  cvAnalysisReportSchema,
  cvModelOutputSchema,
  type CvModelOutput,
} from "@/lib/cv/analysis-schema";
import { CvError } from "@/lib/cv/errors";
import { groundAnalysis, normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";
import { computeCvScore, DIMENSION_KEYS, SCORE_DIMENSIONS } from "@/lib/cv/scoring";

const CV_TEXT = [
  "Jordan Rivera",
  "jordan.rivera@example.test",
  "EXPERIENCE",
  "Data Analyst, Northwind Retail (2021 - 2024)",
  "- Built Python and SQL pipelines that cut weekly reporting time by 40%.",
  "- Containerized analytics jobs with Docker.",
  "EDUCATION",
  "BSc Computer Science, Lakeside University, 2021",
  "SKILLS",
  "Python, SQL, Docker, Git",
].join("\n");

function validOutput(overrides: Partial<CvModelOutput> = {}): CvModelOutput {
  return {
    summary: "Data analyst with Python and SQL pipeline experience.",
    candidateProfile: {
      targetRoles: [],
      experienceLevel: "JUNIOR",
      primaryDomain: "Data",
      yearsOfExperience: 3,
    },
    skills: [
      {
        name: "Python",
        category: "PROGRAMMING",
        evidence: "Built Python and SQL pipelines that cut weekly reporting time by 40%",
        confidence: 0.9,
      },
    ],
    strengths: [{ title: "Quantified impact", evidence: "cut weekly reporting time by 40%" }],
    gaps: [{ area: "Projects", type: "NOT_SPECIFIED", detail: "No projects are listed." }],
    recommendations: [{ priority: "HIGH", title: "Add projects", detail: "List 1-2 projects." }],
    sections: {
      contact: true,
      summary: false,
      education: true,
      experience: true,
      skills: true,
      projects: false,
      certifications: false,
    },
    formatting: { readability: 8, consistency: 7, structure: 7 },
    dimensions: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, { rating: 5, rationale: `Rationale for ${k}.` }]),
    ) as CvModelOutput["dimensions"],
    ...overrides,
  };
}

function fakeProvider(result: StructuredResult<unknown>): AIProvider {
  return {
    name: "fake",
    isMock: false,
    generateStructured: async () => result as never,
  };
}

const input = { cvText: CV_TEXT, truncated: false, wordCount: 50 };

describe("computeCvScore", () => {
  it("weights sum to 100", () => {
    expect(SCORE_DIMENSIONS.reduce((s, d) => s + d.weight, 0)).toBe(100);
  });

  it("derives the overall score from weighted dimension ratings", () => {
    const ratings = Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, { rating: 10, rationale: "" }]),
    ) as Parameters<typeof computeCvScore>[0];
    expect(computeCvScore(ratings).overall).toBe(100);

    ratings.experience.rating = 0; // weight 20
    ratings.projects.rating = 5; // weight 10 → 5 points
    const result = computeCvScore(ratings);
    expect(result.overall).toBe(75);
    expect(result.dimensions.find((d) => d.key === "projects")?.points).toBe(5);
  });

  it("clamps out-of-range ratings", () => {
    const ratings = Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, { rating: 42, rationale: "" }]),
    ) as Parameters<typeof computeCvScore>[0];
    expect(computeCvScore(ratings).overall).toBe(100);
  });
});

describe("AI output validation", () => {
  it("accepts a well-formed output", () => {
    expect(cvModelOutputSchema.safeParse(validOutput()).success).toBe(true);
  });

  it.each([
    ["rating above 10", { formatting: { readability: 11, consistency: 5, structure: 5 } }],
    ["unknown gap type", { gaps: [{ area: "x", type: "BAD", detail: "y" }] }],
    [
      "unknown skill category",
      { skills: [{ name: "X", category: "MAGIC", evidence: "e", confidence: 0.5 }] },
    ],
    [
      "confidence above 1",
      { skills: [{ name: "X", category: "TOOLS", evidence: "e", confidence: 3 }] },
    ],
    ["missing sections", { sections: undefined }],
  ])("rejects %s", (_, overrides) => {
    expect(cvModelOutputSchema.safeParse({ ...validOutput(), ...overrides }).success).toBe(false);
  });
});

describe("groundAnalysis", () => {
  it("removes skills and strengths that cannot be found in the CV", () => {
    const grounded = groundAnalysis(
      validOutput({
        skills: [
          {
            name: "Python",
            category: "PROGRAMMING",
            evidence: "Built Python and SQL pipelines",
            confidence: 0.9,
          },
          // Fabricated: neither the name nor the quote is in the CV.
          {
            name: "Kubernetes",
            category: "CLOUD_DEVOPS",
            evidence: "Managed Kubernetes clusters",
            confidence: 0.8,
          },
          // Name present, quote paraphrased: kept but not verified.
          {
            name: "Docker",
            category: "CLOUD_DEVOPS",
            evidence: "Expert in Docker orchestration",
            confidence: 0.6,
          },
          // Duplicate is dropped without counting as unverifiable.
          { name: "python", category: "PROGRAMMING", evidence: "Python, SQL", confidence: 0.5 },
        ],
        strengths: [
          { title: "Impact", evidence: "cut weekly reporting time by 40%" },
          { title: "Leadership", evidence: "Led a team of 12 engineers" },
        ],
      }),
      CV_TEXT,
    );
    expect(grounded.skills.map((s) => [s.name, s.verified])).toEqual([
      ["Python", true],
      ["Docker", false],
    ]);
    expect(grounded.removedSkills).toBe(1);
    expect(grounded.strengths.map((s) => s.title)).toEqual(["Impact"]);
    expect(grounded.removedStrengths).toBe(1);
  });

  it("matches terms that end a sentence and keeps dotted names intact", () => {
    const text = "Shipped services with Docker.\nBuilt dashboards in Next.js.";
    expect(termAppearsIn("Docker", normalizeForMatch(text))).toBe(true);
    expect(termAppearsIn("Next.js", normalizeForMatch(text))).toBe(true);
    expect(termAppearsIn("Next", normalizeForMatch("Next.js"))).toBe(false);
  });

  it("matches whole terms only and tolerates elided quotes", () => {
    const grounded = groundAnalysis(
      validOutput({
        skills: [
          { name: "Go", category: "PROGRAMMING", evidence: "Go services", confidence: 0.5 },
          { name: "SQL", category: "DATA", evidence: "Built Python … pipelines", confidence: 0.5 },
        ],
      }),
      CV_TEXT,
    );
    expect(grounded.skills.map((s) => s.name)).toEqual(["SQL"]);
  });
});

describe("analyzeCv", () => {
  it("returns a validated, grounded and scored report", async () => {
    const outcome = await analyzeCv(
      input,
      fakeProvider({ ok: true, data: validOutput(), model: "fake-1" }),
    );
    expect(cvAnalysisReportSchema.safeParse(outcome.report).success).toBe(true);
    expect(outcome.report.score.overall).toBe(50);
    expect(outcome).toMatchObject({ provider: "fake", model: "fake-1", isMock: false });
  });

  it("rejects an invalid AI response instead of saving it", async () => {
    const bad = { ...validOutput(), dimensions: { structure: { rating: "high" } } };
    await expect(
      analyzeCv(input, fakeProvider({ ok: true, data: bad, model: "fake-1" })),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });

  it.each([
    ["timeout", "AI_TIMEOUT"],
    ["rate_limited", "AI_RATE_LIMITED"],
    ["unavailable", "AI_UNAVAILABLE"],
    ["refused", "AI_REFUSED"],
    ["invalid_output", "AI_INVALID_RESPONSE"],
  ] as const)("maps provider error %s to %s", async (error, code) => {
    const promise = analyzeCv(input, fakeProvider({ ok: false, error, message: "x" }));
    await expect(promise).rejects.toBeInstanceOf(CvError);
    await expect(promise).rejects.toMatchObject({ code });
  });
});

describe("mock provider", () => {
  it("is deterministic, grounded and clearly marked as mock", async () => {
    const provider = new MockAIProvider(0);
    const first = await analyzeCv(input, provider);
    const second = await analyzeCv(input, provider);
    expect(first.report).toEqual(second.report);
    expect(first.isMock).toBe(true);
    expect(first.provider).toBe("mock");
    expect(first.report.summary).toMatch(/not an AI assessment/);
    expect(first.report.grounding.removedSkills).toBe(0);
    expect(first.report.skills.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Python", "SQL", "Docker", "Git"]),
    );
  });

  it("produces schema-valid output even for minimal text", () => {
    expect(cvModelOutputSchema.safeParse(mockCvAnalysis("Hello")).success).toBe(true);
  });
});
