import { describe, expect, it, vi } from "vitest";
import {
  generateBio,
  generateHeadline,
  generateSkillSummary,
  improveProjectDescription,
  type ProjectDraft,
} from "@/lib/ai/portfolio";
import { MOCK_FAILURE_MARKER } from "@/lib/ai/mock/portfolio";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AIProvider } from "@/lib/ai/types";
import {
  COMPLETION_ITEMS,
  computePortfolioCompletion,
  type CompletionInput,
} from "@/lib/portfolio/completion";
import {
  classifyAssessment,
  evidenceStrength,
  type EvidenceCounts,
} from "@/lib/portfolio/evidence";
import { PortfolioError, portfolioErrorMessage } from "@/lib/portfolio/errors";
import {
  isGrounded,
  numbersSupported,
  unknownSkills,
  unsupportedClaim,
} from "@/lib/portfolio/grounding";
import { skillSlug, slugify, uniqueSlug } from "@/lib/portfolio/slug";
import {
  achievementSchema,
  certificationSchema,
  educationSchema,
  isSafeUrl,
  itemRefSchema,
  portfolioProfileSchema,
  projectSchema,
  settingsSchema,
  skillNameSchema,
  skillSchema,
  usernameSchema,
} from "@/lib/portfolio/validation";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ AI_TIMEOUT_MS: 1000, AI_PROVIDER: "mock", NODE_ENV: "test" }),
}));

const mock = new MockAIProvider(0);

/** A provider that returns fixed data for any task (to simulate a model that misbehaves). */
function fixed(data: unknown): AIProvider {
  return {
    name: "fixed",
    generateStructured: async () => ({ ok: true, data }),
  } as unknown as AIProvider;
}
function failing(error: "timeout" | "unavailable" | "rate_limited" | "refused"): AIProvider {
  return {
    name: "failing",
    generateStructured: async () => ({ ok: false, error, message: "x" }),
  } as unknown as AIProvider;
}

const validProject = {
  title: "Churn Dashboard",
  shortDescription: "A dashboard that predicts customer churn.",
  description: "",
  role: "",
  technologies: ["Python", "Pandas", "python"],
  skillIds: [],
  repositoryUrl: "https://github.com/me/churn",
  liveUrl: "",
  imageUrl: "",
  startDate: "2024-01-01",
  endDate: "2024-03-01",
  status: "COMPLETED",
  featured: false,
  visibility: "PRIVATE",
};

describe("portfolio validation", () => {
  it("accepts only absolute http(s) URLs without credentials", () => {
    expect(isSafeUrl("https://github.com/me")).toBe(true);
    expect(isSafeUrl("http://localhost:3000/x")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeUrl("//evil.com")).toBe(false);
    expect(isSafeUrl("/relative")).toBe(false);
    expect(isSafeUrl("https://user:pass@example.com")).toBe(false);
    expect(isSafeUrl("https://intranet")).toBe(false);
    expect(isSafeUrl("https://exa mple.com")).toBe(false);
    expect(isSafeUrl("http://example.com", { httpsOnly: true })).toBe(false);
  });

  it("validates a project and normalizes its fields", () => {
    const parsed = projectSchema.parse(validProject);
    // Case-insensitive duplicates collapse into one entry.
    expect(parsed.technologies.map((t) => t.toLowerCase())).toEqual(["python", "pandas"]);
    expect(parsed.description).toBeNull();
    expect(parsed.liveUrl).toBeNull();
    expect(parsed.startDate?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("rejects an end date before the start date, unsafe URLs and http images", () => {
    expect(projectSchema.safeParse({ ...validProject, endDate: "2023-01-01" }).success).toBe(false);
    expect(
      projectSchema.safeParse({ ...validProject, repositoryUrl: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ ...validProject, imageUrl: "http://x.com/a.png" }).success,
    ).toBe(false);
    expect(projectSchema.safeParse({ ...validProject, title: "  " }).success).toBe(false);
    expect(projectSchema.safeParse({ ...validProject, visibility: "EVERYONE" }).success).toBe(
      false,
    );
  });

  it("strips unknown fields such as a browser-supplied userId", () => {
    const parsed = projectSchema.parse({ ...validProject, userId: "someone-else" });
    expect("userId" in parsed).toBe(false);
    const edu = educationSchema.parse({
      institution: "Uni",
      degree: "",
      field: "",
      startDate: "",
      endDate: "",
      grade: "",
      description: "",
      visibility: "PRIVATE",
      userId: "user-b",
    });
    expect("userId" in edu).toBe(false);
  });

  it("validates usernames and blocks reserved ones", () => {
    expect(usernameSchema.parse("Alex-Kim")).toBe("alex-kim");
    for (const bad of [
      "ab",
      "-alex",
      "alex-",
      "al--ex",
      "alex_kim",
      "a".repeat(31),
      "dashboard",
      "admin",
      "api",
    ]) {
      expect(usernameSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("settings: empty username becomes null", () => {
    const base = Object.fromEntries(
      [
        "isPublic",
        "showAbout",
        "showProjects",
        "showSkills",
        "showEducation",
        "showCertifications",
        "showAchievements",
        "showExperience",
        "showLinks",
        "showAssessments",
        "showInterviewScore",
      ].map((k) => [k, false]),
    );
    expect(settingsSchema.parse({ ...base, username: "" }).username).toBeNull();
  });

  it("validates skills, certifications, achievements and profile", () => {
    expect(skillNameSchema.parse("  C++  ")).toBe("C++");
    expect(skillNameSchema.safeParse("<script>").success).toBe(false);
    expect(
      skillSchema.safeParse({ name: "Python", level: "WIZARD", visibility: "PRIVATE" }).success,
    ).toBe(false);
    expect(
      certificationSchema.safeParse({
        name: "AWS CCP",
        issuer: "AWS",
        issueDate: "2024-05-01",
        expirationDate: "2023-05-01",
        credentialId: "",
        credentialUrl: "",
        description: "",
        skills: [],
        visibility: "PRIVATE",
      }).success,
    ).toBe(false);
    expect(
      achievementSchema.safeParse({
        title: "Won",
        kind: "NOBEL",
        description: "",
        issuer: "",
        date: "",
        url: "",
        visibility: "PRIVATE",
      }).success,
    ).toBe(false);
    expect(
      portfolioProfileSchema.safeParse({
        headline: "x".repeat(121),
        bio: "",
        location: "",
        websiteUrl: "",
        githubUrl: "",
        linkedinUrl: "",
      }).success,
    ).toBe(false);
    expect(itemRefSchema.safeParse({ kind: "user", id: "abc" }).success).toBe(false);
    expect(itemRefSchema.safeParse({ kind: "project", id: "abc'; drop" }).success).toBe(false);
  });
});

describe("slugs", () => {
  it("makes URL-safe slugs and resolves collisions", () => {
    expect(slugify("My Café App!")).toBe("my-cafe-app");
    expect(slugify("!!!")).toBe("project");
    expect(slugify("x".repeat(100)).length).toBe(60);
    expect(uniqueSlug("app", ["app", "app-2"])).toBe("app-3");
    expect(uniqueSlug("new", [])).toBe("new");
    expect(skillSlug("C++")).toBe("cplusplus");
    expect(skillSlug("C#")).toBe("csharp");
  });
});

describe("completion", () => {
  const empty: CompletionInput = {
    hasName: false,
    headline: null,
    bio: null,
    projects: 0,
    skills: 0,
    skillsWithEvidence: 0,
    educations: 0,
    certifications: 0,
    achievements: 0,
    isPublic: false,
    username: null,
  };

  it("is 0% with every step listed for an empty portfolio", () => {
    const c = computePortfolioCompletion(empty);
    expect(c.percent).toBe(0);
    expect(c.todo).toHaveLength(COMPLETION_ITEMS.length);
    expect(c.todo.map((t) => t.label)).toContain("Add your first project");
  });

  it("counts each step equally and deterministically", () => {
    const c = computePortfolioCompletion({
      ...empty,
      hasName: true,
      headline: "x",
      skills: 3,
      projects: 1,
    });
    expect(c.completed).toBe(4);
    expect(c.percent).toBe(40);
    expect(computePortfolioCompletion({ ...empty, skills: 2 }).completed).toBe(0);
    expect(computePortfolioCompletion({ ...empty, headline: "   " }).completed).toBe(0);
  });

  it("requires a username for the public step", () => {
    expect(computePortfolioCompletion({ ...empty, isPublic: true }).completed).toBe(0);
    expect(
      computePortfolioCompletion({ ...empty, isPublic: true, username: "alex" }).completed,
    ).toBe(1);
  });

  it("reaches 100% when everything is present", () => {
    const c = computePortfolioCompletion({
      hasName: true,
      headline: "h",
      bio: "b",
      projects: 1,
      skills: 3,
      skillsWithEvidence: 1,
      educations: 1,
      certifications: 1,
      achievements: 1,
      isPublic: true,
      username: "alex",
    });
    expect(c.percent).toBe(100);
    expect(c.todo).toHaveLength(0);
  });
});

describe("evidence strength", () => {
  const none: EvidenceCounts = {
    latestAssessment: null,
    projects: 0,
    certifications: 0,
    interviewAverage: null,
    cvVerified: false,
    jobMatchPresent: false,
    roadmapTasksCompleted: 0,
  };

  it("classifies assessments with the documented thresholds", () => {
    expect(classifyAssessment(100).label).toBe("Strong evidence");
    expect(classifyAssessment(90).label).toBe("Strong evidence");
    expect(classifyAssessment(89).label).toBe("Good evidence");
    expect(classifyAssessment(75).label).toBe("Good evidence");
    expect(classifyAssessment(74).label).toBe("Developing");
    expect(classifyAssessment(60).label).toBe("Developing");
    expect(classifyAssessment(59).label).toBe("Needs improvement");
    expect(classifyAssessment(0).label).toBe("Needs improvement");
  });

  it("is 'Self-reported only' with no evidence", () => {
    expect(evidenceStrength(none)).toEqual({ score: 0, band: "NONE", label: "Self-reported only" });
  });

  it("adds points per source, caps counts and the total", () => {
    expect(evidenceStrength({ ...none, projects: 1 }).score).toBe(15);
    expect(evidenceStrength({ ...none, projects: 5 }).score).toBe(30);
    expect(evidenceStrength({ ...none, latestAssessment: 95, projects: 2 }).score).toBe(70);
    expect(evidenceStrength({ ...none, latestAssessment: 95, projects: 2 }).label).toBe("Strong");
    expect(evidenceStrength({ ...none, interviewAverage: 69 }).score).toBe(5);
    expect(evidenceStrength({ ...none, interviewAverage: 70 }).score).toBe(15);
    expect(evidenceStrength({ ...none, certifications: 2, projects: 1 }).label).toBe("Moderate");
    expect(evidenceStrength({ ...none, jobMatchPresent: true }).label).toBe("Limited");
    const all = evidenceStrength({
      latestAssessment: 100,
      projects: 9,
      certifications: 9,
      interviewAverage: 100,
      cvVerified: true,
      jobMatchPresent: true,
      roadmapTasksCompleted: 9,
    });
    expect(all.score).toBe(100);
  });
});

describe("grounding", () => {
  const source =
    "Churn Dashboard\nA dashboard that predicts customer churn with Python and Pandas.";

  it("rejects invented numbers", () => {
    expect(numbersSupported("Improved accuracy by 35%.", source)).toBe(false);
    expect(numbersSupported("Version 2 of the dashboard.", "Dashboard v2")).toBe(true);
  });

  it("rejects technologies the user never mentioned", () => {
    expect(unknownSkills("Built with Python and Kubernetes.", source)).toEqual(["Kubernetes"]);
    expect(unknownSkills("Built with Python.", source)).toEqual([]);
  });

  it("rejects unsupported employment, client, award and expertise claims", () => {
    expect(unsupportedClaim("Worked at Google on this.", "a side project")).toBe(true);
    expect(unsupportedClaim("Used by 1000 users.", "a side project")).toBe(true);
    expect(unsupportedClaim("Award-winning project.", "a side project")).toBe(true);
    expect(unsupportedClaim("An expert-level build.", "a side project")).toBe(true);
    expect(unsupportedClaim("Delivered for clients.", "Freelance work for clients")).toBe(false);
  });

  it("keeps faithful rephrasing", () => {
    expect(isGrounded("A Python dashboard that predicts churn.", source)).toBe(true);
  });
});

describe("AI portfolio assistance", () => {
  it("headline: role from the options, skills only from the user's list", async () => {
    const text = await generateHeadline(
      { roleOptions: ["Junior Data Analyst"], skills: ["Python", "SQL"] },
      mock,
    );
    expect(text).toBe("Junior Data Analyst | Python · SQL");
    const sneaky = await generateHeadline(
      { roleOptions: ["Junior Data Analyst"], skills: ["Python"] },
      fixed({ roleIndex: 0, skills: ["Python", "Rust", "Kubernetes"] }),
    );
    expect(sneaky).toBe("Junior Data Analyst | Python");
  });

  it("headline: refuses with no input and rejects an out-of-range role", async () => {
    await expect(generateHeadline({ roleOptions: [], skills: [] }, mock)).rejects.toMatchObject({
      code: "NOTHING_TO_GENERATE",
    });
    await expect(
      generateHeadline(
        { roleOptions: ["Analyst"], skills: [] },
        fixed({ roleIndex: 7, skills: [] }),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  it("bio: keeps grounded sentences and drops invented ones", async () => {
    const facts = [
      { key: "goal", text: "Career goal: Data Analyst" },
      { key: "skills", text: "Skills: Python, SQL" },
    ];
    const ok = await generateBio({ facts }, mock);
    expect(ok.bio).toContain("Data Analyst");
    expect(ok.dropped).toBe(0);

    const mixed = await generateBio(
      { facts },
      fixed({
        sentences: [
          { text: "I work with Python and SQL.", sources: ["skills"] },
          { text: "I worked at Google for 5 years.", sources: ["skills"] },
          { text: "I won a hackathon.", sources: ["nonexistent"] },
          { text: "I have no source.", sources: [] },
        ],
      }),
    );
    expect(mixed.bio).toBe("I work with Python and SQL.");
    expect(mixed.dropped).toBe(3);
  });

  it("bio: fails safely when nothing is grounded or nothing is provided", async () => {
    await expect(generateBio({ facts: [] }, mock)).rejects.toMatchObject({
      code: "NOTHING_TO_GENERATE",
    });
    await expect(
      generateBio(
        { facts: [{ key: "skills", text: "Skills: SQL" }] },
        fixed({ sentences: [{ text: "I lead 40 engineers.", sources: ["skills"] }] }),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  const draft: ProjectDraft = {
    title: "Churn Dashboard",
    shortDescription: "A dashboard that predicts customer churn.",
    description: null,
    role: "Solo developer",
    technologies: ["Python", "Pandas"],
    skills: ["Python"],
    status: "COMPLETED",
  };

  it("project: formats a grounded description and filters invented highlights", async () => {
    const result = await improveProjectDescription(draft, mock);
    expect(result.description).toContain("Churn Dashboard");
    expect(result.description).toContain("Highlights:\n- Built with Python, Pandas.");
    const filtered = await improveProjectDescription(
      draft,
      fixed({
        summary: "A churn dashboard built with Python.",
        highlights: ["Uses Pandas.", "Deployed on Kubernetes.", "Raised revenue by 20%."],
        contributions: ["Worked at Netflix on the model."],
      }),
    );
    expect(filtered.description).toContain("- Uses Pandas.");
    expect(filtered.description).not.toMatch(/Kubernetes|revenue|Netflix/);
    expect(filtered.dropped).toBe(3);
  });

  it("project: invalid or ungrounded output fails safely", async () => {
    await expect(
      improveProjectDescription({ ...draft, title: `Demo ${MOCK_FAILURE_MARKER}` }, mock),
    ).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
    });
    await expect(
      improveProjectDescription(
        draft,
        fixed({ summary: "Served 10,000 users.", highlights: [], contributions: [] }),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  it("maps provider failures to safe error codes", async () => {
    await expect(improveProjectDescription(draft, failing("timeout"))).rejects.toMatchObject({
      code: "AI_TIMEOUT",
    });
    await expect(improveProjectDescription(draft, failing("unavailable"))).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
    });
    await expect(improveProjectDescription(draft, failing("rate_limited"))).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
    });
    await expect(improveProjectDescription(draft, failing("refused"))).rejects.toMatchObject({
      code: "AI_REFUSED",
    });
    expect(portfolioErrorMessage("AI_TIMEOUT")).not.toMatch(/stack|error:/i);
  });

  it("skill summary: describes evidence only", async () => {
    const text = await generateSkillSummary(
      { skill: "Python", evidence: ["Churn Dashboard (Project)"] },
      mock,
    );
    expect(text).toContain("Python");
    await expect(
      generateSkillSummary({ skill: "Python", evidence: [] }, mock),
    ).rejects.toBeInstanceOf(PortfolioError);
    await expect(
      generateSkillSummary(
        { skill: "Python", evidence: ["Churn Dashboard"] },
        fixed({ summary: "An expert Python developer." }),
      ),
    ).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });
});
