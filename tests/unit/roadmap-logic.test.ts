import { describe, expect, it } from "vitest";
import { mockRoadmap } from "@/lib/ai/mock/roadmap";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { generateRoadmap, type RoadmapGenerationInput } from "@/lib/ai/roadmap";
import type { AIProvider } from "@/lib/ai/types";
import { groundRoadmap } from "@/lib/roadmap/grounding";
import { normalizePlan } from "@/lib/roadmap/normalize";
import { gapPriority, skillKey, taskPriorities } from "@/lib/roadmap/prioritization";
import { computeProgress, formatPercent, progressByPhase } from "@/lib/roadmap/progress";
import {
  roadmapModelOutputSchema,
  roadmapReportSchema,
  type ModelSkillGap,
  type ModelTask,
  type RoadmapModelOutput,
} from "@/lib/roadmap/schema";
import { checkTransition, resolveLocks } from "@/lib/roadmap/task-status";
import { effortSize, normalizePhaseWeeks, normalizeTaskTime } from "@/lib/roadmap/time";
import { createRoadmapSchema, taskStatusUpdateSchema } from "@/lib/roadmap/validation";

const CV = `Jane Doe
BSc Computer Science, University of Leeds, 2022
Skills: Python, SQL, Git
- Built a churn predictor in Python with scikit-learn
- Wrote SQL reports for the finance team
Familiar with Docker from coursework`;

const JOB = `Machine Learning Engineer
Requirements: Strong Python skills. Experience with Kubernetes in production.
Nice to have: Experience with Docker.`;

function task(overrides: Partial<ModelTask> = {}): ModelTask {
  return {
    key: "t1",
    title: "Learn Kubernetes basics and deploy your churn predictor",
    description: "Deploy an existing app to a local cluster.",
    skill: "Kubernetes",
    category: "TECHNICAL_SKILL",
    estimatedHours: 12,
    estimatedDays: 5,
    prerequisites: [],
    practicalOutcome: "The churn predictor runs on a local cluster.",
    verificationMethod: "kubectl shows the pod running and the endpoint responds.",
    ...overrides,
  };
}

function gap(overrides: Partial<ModelSkillGap> = {}): ModelSkillGap {
  return {
    skill: "Kubernetes",
    status: "NOT_DEMONSTRATED",
    importance: "CRITICAL",
    requirementKind: "REQUIRED",
    reason: "Not demonstrated in your CV.",
    cvEvidence: null,
    targetEvidence: "Experience with Kubernetes in production.",
    ...overrides,
  };
}

function output(overrides: Partial<RoadmapModelOutput> = {}): RoadmapModelOutput {
  return {
    title: "Roadmap to ML Engineer",
    summary: "A plan.",
    currentProfile: {
      education: [],
      strongSkills: [],
      developingSkills: [],
      technologies: [],
      relevantProjects: [],
    },
    skillGaps: [gap()],
    phases: [
      {
        order: 1,
        title: "Applied",
        objective: "Apply skills.",
        estimatedWeeks: 1,
        tasks: [task()],
      },
    ],
    milestones: [],
    recommendations: [],
    ...overrides,
  };
}

const jobContext = { cvText: CV, jobText: JOB, jobRequirementTerms: ["Kubernetes", "Python"] };
const careerContext = { cvText: CV, jobText: null, jobRequirementTerms: [] };

describe("roadmap schema", () => {
  it("accepts a valid model output", () => {
    expect(roadmapModelOutputSchema.safeParse(output()).success).toBe(true);
  });

  it("rejects invalid categories, statuses and estimates", () => {
    const bad = [
      output({
        phases: [{ ...output().phases[0]!, tasks: [task({ category: "MAGIC" as never })] }],
      }),
      output({ skillGaps: [gap({ status: "LACKING" as never })] }),
      output({ phases: [{ ...output().phases[0]!, tasks: [task({ estimatedHours: 0 })] }] }),
      output({ phases: [{ ...output().phases[0]!, tasks: [task({ estimatedHours: 999 })] }] }),
      output({ phases: [] }),
      output({ phases: [{ ...output().phases[0]!, tasks: [task({ key: "bad key!" })] }] }),
    ];
    for (const value of bad) expect(roadmapModelOutputSchema.safeParse(value).success).toBe(false);
  });
});

describe("roadmap grounding", () => {
  it("demotes a STRONG gap whose CV quote can't be found", () => {
    const result = groundRoadmap(
      output({
        skillGaps: [
          gap({
            skill: "Kubernetes",
            status: "STRONG",
            cvEvidence: "Ran Kubernetes clusters at scale",
          }),
        ],
      }),
      jobContext,
    );
    expect(result.skillGaps[0]).toMatchObject({
      status: "NOT_DEMONSTRATED",
      cvEvidence: null,
      adjusted: true,
    });
    expect(result.adjustedGaps).toBe(1);
  });

  it("keeps a STRONG gap with a verified CV quote", () => {
    const result = groundRoadmap(
      output({
        skillGaps: [
          gap({
            skill: "Python",
            status: "STRONG",
            cvEvidence: "Built a churn predictor in Python with scikit-learn",
            targetEvidence: "Strong Python skills.",
          }),
        ],
      }),
      jobContext,
    );
    expect(result.skillGaps[0]).toMatchObject({ status: "STRONG", adjusted: false });
  });

  it("raises NOT_DEMONSTRATED to DEVELOPING when the CV names the skill", () => {
    const result = groundRoadmap(
      output({ skillGaps: [gap({ skill: "Docker", targetEvidence: null })] }),
      jobContext,
    );
    expect(result.skillGaps[0]).toMatchObject({ status: "DEVELOPING", adjusted: true });
  });

  it("drops job-roadmap gaps that can't be traced to the job", () => {
    const result = groundRoadmap(
      output({ skillGaps: [gap({ skill: "Rust", targetEvidence: "Must know Rust" })] }),
      jobContext,
    );
    expect(result.skillGaps).toEqual([]);
    expect(result.removedGaps).toBe(1);
  });

  it("clears fabricated job quotes but keeps gaps traceable to a requirement", () => {
    const result = groundRoadmap(
      output({ skillGaps: [gap({ targetEvidence: "10 years of Kubernetes required" })] }),
      jobContext,
    );
    expect(result.skillGaps[0]).toMatchObject({ skill: "Kubernetes", targetEvidence: null });
  });

  it("clears job fields for career-goal roadmaps and de-duplicates skills", () => {
    const result = groundRoadmap(
      output({ skillGaps: [gap(), gap({ skill: " kubernetes " })] }),
      careerContext,
    );
    expect(result.skillGaps).toHaveLength(1);
    expect(result.skillGaps[0]).toMatchObject({ requirementKind: null, targetEvidence: null });
  });

  it("removes invented profile items", () => {
    const result = groundRoadmap(
      output({
        currentProfile: {
          education: ["BSc Computer Science, University of Leeds, 2022", "PhD in Physics, MIT"],
          strongSkills: ["Python", "Haskell"],
          developingSkills: [],
          technologies: ["Git", "AWS"],
          relevantProjects: [
            "Built a churn predictor in Python with scikit-learn",
            "Led a team of 20",
          ],
        },
      }),
      careerContext,
    );
    expect(result.currentProfile).toEqual({
      education: ["BSc Computer Science, University of Leeds, 2022"],
      strongSkills: ["Python"],
      developingSkills: [],
      technologies: ["Git"],
      relevantProjects: ["Built a churn predictor in Python with scikit-learn"],
    });
    expect(result.removedProfileItems).toBe(4);
  });
});

describe("roadmap prioritization", () => {
  it("follows the documented priority table", () => {
    const p = (
      status: ModelSkillGap["status"],
      importance: ModelSkillGap["importance"],
      kind: ModelSkillGap["requirementKind"],
    ) => gapPriority({ status, importance, requirementKind: kind });
    expect(p("NOT_DEMONSTRATED", "CRITICAL", "REQUIRED")).toBe("CRITICAL");
    expect(p("NOT_DEMONSTRATED", "NICE_TO_HAVE", "REQUIRED")).toBe("HIGH");
    expect(p("NOT_DEMONSTRATED", "CRITICAL", "PREFERRED")).toBe("HIGH");
    expect(p("NOT_DEMONSTRATED", "IMPORTANT", null)).toBe("MEDIUM");
    expect(p("DEVELOPING", "CRITICAL", "REQUIRED")).toBe("HIGH");
    expect(p("DEVELOPING", "NICE_TO_HAVE", "PREFERRED")).toBe("LOW");
    expect(p("STRONG", "CRITICAL", "REQUIRED")).toBe("LOW");
  });

  it("is deterministic and lets prerequisites inherit their dependents' priority (capped at HIGH)", () => {
    const tasks = [
      { key: "a", skill: "Linux", category: "FUNDAMENTALS" as const, dependsOn: [] },
      { key: "b", skill: "Kubernetes", category: "TECHNICAL_SKILL" as const, dependsOn: ["a"] },
      { key: "c", skill: "CV writing", category: "CAREER_PREPARATION" as const, dependsOn: [] },
    ];
    const gaps = new Map([[skillKey("Kubernetes"), "CRITICAL" as const]]);
    const first = taskPriorities(tasks, gaps);
    expect(Object.fromEntries(first)).toEqual({ a: "HIGH", b: "CRITICAL", c: "LOW" });
    expect(Object.fromEntries(taskPriorities(tasks, gaps))).toEqual(Object.fromEntries(first));
  });
});

describe("roadmap time estimates", () => {
  it("keeps days consistent with hours and clamps extremes", () => {
    expect(normalizeTaskTime(40, 1)).toEqual({ estimatedHours: 40, estimatedDays: 10 });
    expect(normalizeTaskTime(200, 120).estimatedHours).toBeLessThanOrEqual(120);
    expect(normalizeTaskTime(200, 120).estimatedDays).toBeLessThanOrEqual(90);
  });

  it("phase weeks cover the task days and are capped", () => {
    expect(normalizePhaseWeeks(1, [10, 10])).toBe(4);
    expect(normalizePhaseWeeks(3, [2])).toBe(3);
    expect(normalizePhaseWeeks(26, [90, 90])).toBe(26);
  });

  it("classifies effort", () => {
    expect([effortSize(3), effortSize(10), effortSize(30)]).toEqual(["Small", "Medium", "Large"]);
  });
});

describe("roadmap plan normalization", () => {
  it("renumbers phases, drops forward/unknown prerequisites and dedupes keys", () => {
    const plan = normalizePlan(
      {
        phases: [
          {
            order: 5,
            title: "Later",
            objective: "x",
            estimatedWeeks: 1,
            tasks: [task({ key: "t2", prerequisites: ["t1", "t9"] })],
          },
          {
            order: 2,
            title: "First",
            objective: "x",
            estimatedWeeks: 1,
            tasks: [task({ key: "t1", prerequisites: ["t2"] }), task({ key: "t1" })],
          },
        ],
        milestones: [
          { title: "M", description: "d", phaseOrder: 5, verification: "v" },
          { title: "Orphan", description: "d", phaseOrder: 9, verification: "v" },
        ],
      },
      new Map(),
    );
    expect(plan.phases.map((p) => [p.order, p.title])).toEqual([
      [1, "First"],
      [2, "Later"],
    ]);
    expect(plan.tasks.map((t) => t.key)).toEqual(["t1", "t1-2", "t2"]);
    expect(plan.tasks.map((t) => t.position)).toEqual([1, 2, 3]);
    expect(plan.tasks[0]!.dependsOn).toEqual([]);
    expect(plan.tasks[2]!.dependsOn).toEqual(["t1"]);
    expect(plan.tasks[2]!.prerequisites).toEqual([plan.tasks[0]!.title]);
    expect(plan.droppedPrerequisites).toBe(2);
    expect(plan.milestones).toEqual([
      { title: "M", description: "d", phaseOrder: 2, verification: "v" },
    ]);
  });
});

describe("roadmap progress", () => {
  it("is completed ÷ total", () => {
    const tasks = [
      ...Array.from({ length: 5 }, () => ({ status: "COMPLETED" as const })),
      ...Array.from({ length: 7 }, () => ({ status: "AVAILABLE" as const })),
    ];
    expect(computeProgress(tasks)).toEqual({
      total: 12,
      completed: 5,
      inProgress: 0,
      percent: 41.7,
    });
    expect(formatPercent(41.7)).toBe("41.7%");
    expect(formatPercent(40)).toBe("40%");
    expect(computeProgress([]).percent).toBe(0);
  });

  it("is computed per phase", () => {
    const map = progressByPhase([
      { status: "COMPLETED", phaseOrder: 1 },
      { status: "AVAILABLE", phaseOrder: 1 },
      { status: "IN_PROGRESS", phaseOrder: 2 },
    ]);
    expect(map.get(1)).toMatchObject({ completed: 1, total: 2, percent: 50 });
    expect(map.get(2)).toMatchObject({ completed: 0, inProgress: 1, total: 1 });
  });
});

describe("roadmap task status", () => {
  it("rejects leaving LOCKED and no-op transitions", () => {
    expect(checkTransition("LOCKED", "COMPLETED")).toEqual({ ok: false, reason: "LOCKED" });
    expect(checkTransition("AVAILABLE", "AVAILABLE")).toEqual({ ok: false, reason: "UNCHANGED" });
    expect(checkTransition("AVAILABLE", "IN_PROGRESS")).toEqual({ ok: true });
    expect(checkTransition("COMPLETED", "AVAILABLE")).toEqual({ ok: true });
  });

  it("locks tasks until their prerequisites are completed", () => {
    const tasks = [
      { key: "a", status: "AVAILABLE" as const, dependsOn: [] },
      { key: "b", status: "AVAILABLE" as const, dependsOn: ["a"] },
      { key: "c", status: "IN_PROGRESS" as const, dependsOn: ["a"] },
    ];
    expect(Object.fromEntries(resolveLocks(tasks))).toEqual({
      a: "AVAILABLE",
      b: "LOCKED",
      c: "IN_PROGRESS",
    });
    tasks[0] = { ...tasks[0]!, status: "COMPLETED" as never };
    expect(resolveLocks(tasks).get("b")).toBe("AVAILABLE");
  });

  it("only accepts user-settable statuses", () => {
    expect(taskStatusUpdateSchema.safeParse({ taskId: "abc", status: "LOCKED" }).success).toBe(
      false,
    );
    expect(taskStatusUpdateSchema.safeParse({ taskId: "abc", status: "COMPLETED" }).success).toBe(
      true,
    );
  });
});

describe("roadmap source validation", () => {
  it("accepts the two sources and rejects anything else", () => {
    expect(createRoadmapSchema.safeParse({ source: "JOB_MATCH", jobId: "abc123" }).success).toBe(
      true,
    );
    expect(
      createRoadmapSchema.parse({ source: "CAREER_GOAL", cvId: "abc123", timeframeWeeks: "12" }),
    ).toEqual({ source: "CAREER_GOAL", cvId: "abc123", timeframeWeeks: 12 });
    expect(
      createRoadmapSchema.parse({ source: "CAREER_GOAL", cvId: "abc123", timeframeWeeks: "" }),
    ).toMatchObject({ timeframeWeeks: null });
    for (const bad of [
      { source: "SOMETHING", jobId: "abc" },
      { source: "JOB_MATCH" },
      { source: "JOB_MATCH", jobId: "../etc" },
      { source: "CAREER_GOAL", cvId: "abc", timeframeWeeks: "7" },
      { source: "JOB_MATCH", jobId: "abc", userId: "someone-else" },
    ]) {
      const parsed = createRoadmapSchema.safeParse(bad);
      // A smuggled userId is stripped, never used.
      if (parsed.success) expect(parsed.data).not.toHaveProperty("userId");
      else expect(parsed.success).toBe(false);
    }
  });
});

const careerInput: RoadmapGenerationInput = {
  target: { type: "career_goal", title: "Machine Learning Engineer", company: null },
  sourceLabel: "Career-goal roadmap",
  cvText: CV,
  cvTruncated: false,
  verifiedCvSkills: ["Python", "SQL"],
  experienceLevel: "Not specified",
  job: null,
  timeframeWeeks: 12,
};

const jobInput: RoadmapGenerationInput = {
  ...careerInput,
  target: { type: "job", title: "Machine Learning Engineer", company: "Acme" },
  job: {
    description: JOB,
    requirements: [
      {
        term: "Python",
        kind: "REQUIRED",
        importance: "CRITICAL",
        match: "PRESENT",
        evidenceFromJob: "Strong Python skills.",
        evidenceFromCv: "Built a churn predictor in Python with scikit-learn",
      },
      {
        term: "Kubernetes",
        kind: "REQUIRED",
        importance: "CRITICAL",
        match: "MISSING",
        evidenceFromJob: "Experience with Kubernetes in production.",
        evidenceFromCv: null,
      },
      {
        term: "Docker",
        kind: "PREFERRED",
        importance: "NICE_TO_HAVE",
        match: "PARTIAL",
        evidenceFromJob: "Experience with Docker.",
        evidenceFromCv: null,
      },
    ],
  },
};

describe("roadmap generation (mock provider)", () => {
  it("is deterministic and produces a valid, grounded report", async () => {
    const a = await generateRoadmap(jobInput, new MockAIProvider());
    const b = await generateRoadmap(jobInput, new MockAIProvider());
    expect(a).toEqual(b);
    expect(roadmapReportSchema.safeParse(a.report).success).toBe(true);
    expect(a.isMock).toBe(true);
    const k8s = a.report.skillGaps.find((g) => g.skill === "Kubernetes");
    expect(k8s).toMatchObject({ status: "NOT_DEMONSTRATED", priority: "CRITICAL" });
    expect(a.tasks.find((t) => t.skill === "Kubernetes")?.priority).toBe("CRITICAL");
    expect(a.report.currentProfile.experienceLevel).toBe("Not specified");
    // Project depends on the applied task; job-readiness tasks depend on the project.
    const project = a.tasks.find((t) => t.category === "PROJECT")!;
    expect(project.dependsOn.length).toBeGreaterThan(0);
    expect(a.tasks.filter((t) => t.dependsOn.includes(project.key))).toHaveLength(2);
  });

  it("builds career-goal roadmaps without job fields", async () => {
    const result = await generateRoadmap(careerInput, new MockAIProvider());
    expect(result.report.target.type).toBe("career_goal");
    expect(
      result.report.skillGaps.every((g) => g.requirementKind === null && g.targetEvidence === null),
    ).toBe(true);
    expect(result.report.timeline.timeframeWeeks).toBe(12);
    expect(mockRoadmap(careerInput).skillGaps.map((g) => g.skill)).toContain("PyTorch");
  });

  it("maps invalid AI output and provider errors to safe codes", async () => {
    const invalid: AIProvider = {
      name: "fake",
      isMock: false,
      generateStructured: async () => ({ ok: true, data: { title: "x" } as never, model: "m" }),
    };
    await expect(generateRoadmap(careerInput, invalid)).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
    });

    for (const [error, code] of [
      ["timeout", "AI_TIMEOUT"],
      ["rate_limited", "AI_RATE_LIMITED"],
      ["unavailable", "AI_UNAVAILABLE"],
      ["invalid_output", "AI_INVALID_RESPONSE"],
    ] as const) {
      const failing: AIProvider = {
        name: "fake",
        isMock: false,
        generateStructured: async () => ({ ok: false, error, message: "x" }),
      };
      await expect(generateRoadmap(careerInput, failing)).rejects.toMatchObject({ code });
    }
  });
});
