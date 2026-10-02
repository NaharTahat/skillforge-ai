import type { RoadmapGenerationInput } from "@/lib/ai/roadmap";
import type { ModelSkillGap, ModelTask, RoadmapModelOutput } from "@/lib/roadmap/schema";
import { SKILL_RULES } from "./skill-rules";

/**
 * Deterministic, rule-based stand-in for AI roadmap generation
 * (AI_PROVIDER=mock). Job roadmaps reuse the Job Match requirement results;
 * career-goal roadmaps use a fixed skill template per role, checked against
 * the CV with simple keyword rules. NOT an AI assessment; labelled in the UI.
 */

const ROLE_SKILLS: Record<string, string[]> = {
  "AI Engineer": [
    "Python",
    "Machine Learning",
    "Deep Learning",
    "REST APIs",
    "Docker",
    "AWS",
    "Git",
  ],
  "Machine Learning Engineer": [
    "Python",
    "Machine Learning",
    "PyTorch",
    "SQL",
    "Docker",
    "Kubernetes",
    "Git",
  ],
  "Data Scientist": ["Python", "SQL", "Pandas", "Machine Learning", "Tableau", "Git"],
  "Data Analyst": ["SQL", "Excel", "Python", "Pandas", "Power BI", "Tableau"],
  "Software Engineer": ["Git", "Python", "Java", "SQL", "REST APIs", "Docker", "CI/CD"],
  "Cybersecurity Analyst": ["Linux", "Network Security", "SIEM", "Penetration Testing", "Python"],
  "Frontend Developer": ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Git"],
  "Backend Developer": ["Node.js", "SQL", "PostgreSQL", "REST APIs", "Docker", "Git"],
  "Full Stack Developer": ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Docker", "Git"],
};
const DEFAULT_SKILLS = ["Git", "Python", "SQL", "Communication"];

const IMPORTANCE_ORDER = { CRITICAL: 0, IMPORTANT: 1, NICE_TO_HAVE: 2 } as const;

const DEGREE = /\b(bachelor|master|phd|bsc|msc|degree|university)\b/i;

function cvLines(cvText: string) {
  return cvText
    .split("\n")
    .map((l) =>
      l
        .replace(/^[-•*▪◦]\s*/, "")
        .trim()
        .slice(0, 200),
    )
    .filter(Boolean);
}

function careerGaps(cvText: string, role: string): ModelSkillGap[] {
  const lines = cvLines(cvText);
  return (ROLE_SKILLS[role] ?? DEFAULT_SKILLS).map((skill, i) => {
    const rule = SKILL_RULES.find((r) => r.name === skill);
    const line = rule ? lines.find((l) => rule.pattern.test(l)) : undefined;
    return {
      skill,
      status: line ? "STRONG" : "NOT_DEMONSTRATED",
      importance: i < 3 ? "CRITICAL" : i < 5 ? "IMPORTANT" : "NICE_TO_HAVE",
      requirementKind: null,
      reason: line
        ? `Mock check: "${skill}" appears in your CV.`
        : `Mock check: "${skill}" is typical for this role and not demonstrated in your CV.`,
      cvEvidence: line ? line.slice(0, 300) : null,
      targetEvidence: null,
    };
  });
}

function jobGaps(input: NonNullable<RoadmapGenerationInput["job"]>): ModelSkillGap[] {
  return input.requirements.slice(0, 30).map((r) => ({
    skill: r.term.slice(0, 60),
    status:
      r.match === "PRESENT" ? "STRONG" : r.match === "PARTIAL" ? "DEVELOPING" : "NOT_DEMONSTRATED",
    importance: r.importance,
    requirementKind: r.kind,
    reason:
      r.match === "MISSING"
        ? `Mock check: the job asks for ${r.term}; it is not demonstrated in your CV.`
        : `Mock check: based on the Job Match result for ${r.term}.`,
    cvEvidence: r.match === "PRESENT" ? r.evidenceFromCv : null,
    targetEvidence: r.evidenceFromJob.slice(0, 300),
  }));
}

export function mockRoadmap(input: RoadmapGenerationInput): RoadmapModelOutput {
  const lines = cvLines(input.cvText);
  const gaps = input.job ? jobGaps(input.job) : careerGaps(input.cvText, input.target.title);
  const strong = gaps.filter((g) => g.status === "STRONG");
  const developing = gaps.filter((g) => g.status === "DEVELOPING");
  // Most important first, so the applied phase and project target the critical gaps.
  const missing = gaps
    .filter((g) => g.status === "NOT_DEMONSTRATED")
    .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);

  const tasks: ModelTask[][] = [[], [], [], []];
  let n = 0;
  const key = () => `t${++n}`;

  // Phase 1 — foundations: strengthen what's partly there (or review basics).
  for (const g of developing.slice(0, 3)) {
    tasks[0]!.push({
      key: key(),
      title: `Strengthen ${g.skill} with a focused exercise`,
      description: `Work through a short, practical exercise set in ${g.skill} and apply it to code or data you already have.`,
      skill: g.skill,
      category: "FUNDAMENTALS",
      estimatedHours: 6,
      estimatedDays: 3,
      prerequisites: [],
      practicalOutcome: `A small, working example that uses ${g.skill}.`,
      verificationMethod: `The example runs end to end and is committed to a repository.`,
    });
  }
  if (tasks[0]!.length === 0) {
    tasks[0]!.push({
      key: key(),
      title: `Review the fundamentals for ${input.target.title}`,
      description:
        "List the core concepts of the target role and refresh any you haven't used recently.",
      skill: strong[0]?.skill ?? "Fundamentals",
      category: "FUNDAMENTALS",
      estimatedHours: 4,
      estimatedDays: 2,
      prerequisites: [],
      practicalOutcome: "A one-page study checklist with notes on each concept.",
      verificationMethod: "Every checklist item has a short written explanation or code snippet.",
    });
  }

  // Phase 2 — applied skills for what isn't demonstrated.
  const appliedKeys = new Map<string, string>();
  for (const g of missing.slice(0, 4)) {
    const k = key();
    appliedKeys.set(g.skill, k);
    tasks[1]!.push({
      key: k,
      title: `Learn ${g.skill} basics and apply it to an existing project`,
      description: `Study the essentials of ${g.skill}, then use it in one of your own projects instead of a tutorial example.`,
      skill: g.skill,
      category: "TECHNICAL_SKILL",
      estimatedHours: 12,
      estimatedDays: 5,
      prerequisites: [],
      practicalOutcome: `One of your projects uses ${g.skill} in a meaningful way.`,
      verificationMethod: `The project builds and runs, and the README explains how ${g.skill} is used.`,
    });
  }
  if (tasks[1]!.length === 0) {
    tasks[1]!.push({
      key: key(),
      title: "Deepen your strongest skill with a harder problem",
      description:
        "Pick a challenging, realistic problem in your strongest area and solve it end to end.",
      skill: strong[0]?.skill ?? "Problem solving",
      category: "TECHNICAL_SKILL",
      estimatedHours: 10,
      estimatedDays: 4,
      prerequisites: [],
      practicalOutcome: "A documented solution to a non-trivial problem.",
      verificationMethod: "Tests or example runs demonstrate the solution works.",
    });
  }

  // Phase 3 — one portfolio project combining the top gaps.
  const projectSkills = missing.slice(0, 2).map((g) => g.skill);
  const projectKey = key();
  tasks[2]!.push({
    key: projectKey,
    title: `Build a portfolio project for ${input.target.title}`,
    description: `Build a small but production-style project that uses ${projectSkills.join(" and ") || "your core skills"}, with a clear README.`,
    skill: projectSkills[0] ?? strong[0]?.skill ?? "Portfolio",
    category: "PROJECT",
    estimatedHours: 30,
    estimatedDays: 10,
    prerequisites: projectSkills.map((s) => appliedKeys.get(s)).filter((k): k is string => !!k),
    practicalOutcome: "A public repository with working code, setup instructions and screenshots.",
    verificationMethod: "A fresh clone runs successfully by following only the README.",
  });

  // Phase 4 — job readiness.
  tasks[3]!.push(
    {
      key: key(),
      title: "Update your CV with what you've genuinely built",
      description:
        "Add the new project and skills you can now demonstrate, with concrete outcomes.",
      skill: "CV writing",
      category: "CAREER_PREPARATION",
      estimatedHours: 3,
      estimatedDays: 1,
      prerequisites: [projectKey],
      practicalOutcome: "An updated CV that links to the portfolio project.",
      verificationMethod:
        "Re-run the CV Analyzer and confirm the new skills are detected with evidence.",
    },
    {
      key: key(),
      title: "Practice interview questions for the target role",
      description: `Practice explaining your project and answering questions on ${[...projectSkills, ...strong.slice(0, 2).map((g) => g.skill)].join(", ") || "your core skills"}.`,
      skill: "Interview preparation",
      category: "INTERVIEW_PREPARATION",
      estimatedHours: 6,
      estimatedDays: 3,
      prerequisites: [projectKey],
      practicalOutcome:
        "Written answers to ten likely questions and a two-minute project walkthrough.",
      verificationMethod: "You can explain every design decision in your project without notes.",
    },
  );

  return {
    title: `Roadmap to ${input.target.title}`,
    summary: `Mock roadmap (rule-based development provider): ${strong.length} strong, ${developing.length} developing and ${missing.length} not-demonstrated skills for ${input.target.title}. This is not an AI assessment.`,
    currentProfile: {
      education: lines.filter((l) => DEGREE.test(l)).slice(0, 3),
      strongSkills: strong.map((g) => g.skill),
      developingSkills: developing.map((g) => g.skill),
      technologies: SKILL_RULES.filter((r) => r.pattern.test(input.cvText))
        .map((r) => r.name)
        .slice(0, 10),
      relevantProjects: lines.filter((l) => /\bproject|predictor|built\b/i.test(l)).slice(0, 3),
    },
    skillGaps: gaps,
    phases: [
      {
        order: 1,
        title: "Foundations",
        objective: "Strengthen the basics you'll build on.",
        estimatedWeeks: 1,
        tasks: tasks[0]!,
      },
      {
        order: 2,
        title: "Applied skills",
        objective: "Turn missing skills into hands-on experience.",
        estimatedWeeks: 2,
        tasks: tasks[1]!,
      },
      {
        order: 3,
        title: "Portfolio project",
        objective: "Show the target skills in one relevant project.",
        estimatedWeeks: 3,
        tasks: tasks[2]!,
      },
      {
        order: 4,
        title: "Job readiness",
        objective: "Present your work and prepare for interviews.",
        estimatedWeeks: 1,
        tasks: tasks[3]!,
      },
    ],
    milestones: [
      {
        title: "Applied every new skill in real code",
        description: "Each skill from the applied phase is used in one of your own projects.",
        phaseOrder: 2,
        verification: "Each project runs and its README names the skill it demonstrates.",
      },
      {
        title: "Shipped a portfolio project",
        description: "A complete, documented project relevant to the target role.",
        phaseOrder: 3,
        verification: "A fresh clone runs by following the README alone.",
      },
      {
        title: "Ready to apply",
        description: "Your CV reflects verified skills and you can present your work.",
        phaseOrder: 4,
        verification: "The CV Analyzer detects the new skills with evidence.",
      },
    ],
    recommendations: [
      "Only add skills to your CV once you can demonstrate them.",
      "Prefer one finished, well-documented project over several unfinished ones.",
    ],
  };
}
