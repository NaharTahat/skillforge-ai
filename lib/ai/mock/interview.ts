import type { AnswerEvaluationInput, InterviewGenerationInput } from "@/lib/ai/interview";
import type { Focus, QuestionKind } from "@/lib/interview/constants";
import { KINDS_BY_TYPE } from "@/lib/interview/grounding";
import type {
  AnswerEvaluationOutput,
  InterviewQuestionsOutput,
  ModelQuestion,
} from "@/lib/interview/schema";

/**
 * Deterministic, rule-based stand-in for AI interviews (AI_PROVIDER=mock).
 * Questions are built only from the user's real sources (verified CV skills
 * and lines, Job Match requirements, roadmap gaps) plus standard behavioral/HR
 * questions. Evaluation uses simple length/overlap rules. NOT an AI assessment;
 * labelled as mock in the UI.
 */

const ROLE_TOPICS: Record<string, string[]> = {
  "AI Engineer": ["Python", "Machine Learning", "Deep Learning", "REST APIs", "Docker"],
  "Machine Learning Engineer": ["Python", "Machine Learning", "PyTorch", "SQL", "Docker"],
  "Data Scientist": ["Python", "SQL", "Pandas", "Machine Learning", "Statistics"],
  "Data Analyst": ["SQL", "Excel", "Python", "Power BI", "Data visualization"],
  "Software Engineer": ["Git", "Python", "Java", "SQL", "REST APIs"],
  "Cybersecurity Analyst": ["Linux", "Network Security", "SIEM", "Incident response", "Python"],
  "Frontend Developer": ["HTML", "CSS", "JavaScript", "TypeScript", "React"],
  "Backend Developer": ["Node.js", "SQL", "PostgreSQL", "REST APIs", "Docker"],
  "Full Stack Developer": ["JavaScript", "TypeScript", "React", "Node.js", "SQL"],
};
const DEFAULT_TOPICS = ["Problem solving", "Git", "SQL", "Communication"];

const BEHAVIORAL = [
  "Tell me about a project where you had to solve a difficult technical problem. What was the problem, what did you do, and what was the result?",
  "Describe a time you had to learn something new quickly to finish a task. How did you approach it?",
  "Tell me about a time you received critical feedback. What did you change afterwards?",
  "Describe a situation where you disagreed with a teammate. How did you handle it?",
  "Tell me about a mistake you made in your work or studies and what you learned from it.",
  "Describe a time you had several deadlines at once. How did you prioritize?",
  "Tell me about a time you explained a technical idea to someone without a technical background.",
  "Describe a goal you set for yourself and how you tracked your progress toward it.",
  "Tell me about a time you improved a process or a piece of work without being asked.",
  "Describe a situation where requirements changed late. How did you adapt?",
  "Tell me about a time you helped a colleague or classmate get unblocked.",
  "Describe the most challenging piece of work you are proud of and why.",
  "Tell me about a time you had to make a decision with incomplete information.",
  "Describe how you make sure your work is correct before you hand it over.",
  "Tell me about a time a plan didn't work. What did you do next?",
];

const HR = [
  "Walk me through your background and what brought you to this kind of role.",
  "Why are you interested in this role, and what do you hope to learn in it?",
  "What kind of work environment helps you do your best work?",
  "Where would you like your career to be in two or three years?",
  "What are you currently doing to develop your skills?",
  "How do you handle a week when everything feels urgent?",
  "What motivates you most in your work?",
  "How would your previous teammates or classmates describe working with you?",
  "What questions would you ask to understand whether a team is a good fit for you?",
  "Is there anything you would like the interviewer to know that isn't on your CV?",
];

const TECH_TEMPLATES = [
  (s: string, t: string) =>
    `How would you explain the core ideas of ${s} to a new teammate, and where have they mattered in ${t} work?`,
  (s: string) =>
    `Describe a realistic problem you could solve with ${s}. Walk through your approach and how you would verify the result.`,
  (s: string) => `What are common pitfalls when working with ${s}, and how would you avoid them?`,
];
const GAP_TEMPLATES = [
  (s: string, t: string) =>
    `This question explores your current familiarity with ${s}. How would you approach using ${s} in a ${t} role, and what would you check first?`,
  (s: string) =>
    `This question explores your current familiarity with ${s}. If you had to start using ${s} next week, how would you get productive with it?`,
];
const CV_TEMPLATES = [
  (s: string) =>
    `Your CV lists ${s}. Describe a situation where you used it and a decision you made along the way.`,
  (s: string) =>
    `You mention ${s} in your CV. What is something you learned about ${s} the hard way?`,
];

const PROJECT_LINE =
  /\b(built|developed|created|designed|implemented|project|predictor|dashboard|pipeline|app)\b/i;

type Pool = { focus: Focus | "OTHER"; items: ModelQuestion[] };

function cvLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.replace(/^[-•*▪◦]\s*/, "").trim())
    .filter((l) => l.length >= 25);
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
/** Clips at a word boundary so the quote still matches the CV word for word. */
const clipWords = (s: string, n: number) =>
  s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") : s;

export function mockInterviewQuestions(input: InterviewGenerationInput): InterviewQuestionsOutput {
  const target = input.target.title;
  const q = (
    kind: QuestionKind,
    question: string,
    extra: Omit<ModelQuestion, "kind" | "question">,
  ): ModelQuestion => ({
    kind,
    question: clip(question, 600),
    ...extra,
    skill: extra.skill ? clip(extra.skill, 60) : null,
    sourceReason: clip(extra.sourceReason, 300),
    sourceEvidence: extra.sourceEvidence ? clip(extra.sourceEvidence, 300) : null,
  });

  const requirements = input.job?.requirements ?? [];
  const gaps: ModelQuestion[] = [];
  const jobQs: ModelQuestion[] = [];
  const technical: ModelQuestion[] = [];

  GAP_TEMPLATES.forEach((template) => {
    for (const r of requirements.filter((r) => r.match !== "PRESENT")) {
      gaps.push(
        q("GAP", template(r.term, target), {
          skill: r.term,
          source: "JOB_MATCH",
          sourceReason: `${r.term} was identified as ${r.match === "MISSING" ? "not demonstrated in your CV" : "a partial match"} in your Job Match.`,
          sourceEvidence: null,
        }),
      );
    }
    for (const skill of input.roadmap?.gapSkills ?? []) {
      gaps.push(
        q("GAP", template(skill, target), {
          skill,
          source: "ROADMAP",
          sourceReason: `Your career roadmap lists ${skill} as a skill to develop.`,
          sourceEvidence: null,
        }),
      );
    }
  });

  TECH_TEMPLATES.forEach((template) => {
    for (const r of requirements.filter((r) => r.match === "PRESENT")) {
      jobQs.push(
        q("JOB", template(r.term, target), {
          skill: r.term,
          source: "JOB_DESCRIPTION",
          sourceReason: `The position asks for ${r.term}.`,
          sourceEvidence: r.evidenceFromJob,
        }),
      );
    }
    if (input.source === "CAREER_GOAL") {
      for (const topic of ROLE_TOPICS[target] ?? DEFAULT_TOPICS) {
        technical.push(
          q("TECHNICAL", template(topic, target), {
            skill: topic,
            source: "CAREER_GOAL",
            sourceReason: `${topic} is commonly expected for a ${target}.`,
            sourceEvidence: null,
          }),
        );
      }
    }
  });

  // Technical depth on skills the CV analysis verified.
  TECH_TEMPLATES.forEach((template) => {
    for (const skill of input.verifiedCvSkills.slice(0, 6)) {
      technical.push(
        q("TECHNICAL", template(skill, target), {
          skill,
          source: "CV_ANALYSIS",
          sourceReason: `${skill} was verified in your CV analysis.`,
          sourceEvidence: null,
        }),
      );
    }
  });

  const cvSkills: ModelQuestion[] = [];
  CV_TEMPLATES.forEach((template) => {
    for (const skill of input.verifiedCvSkills.slice(0, 8)) {
      cvSkills.push(
        q("CV", template(skill), {
          skill,
          source: "CV",
          sourceReason: `${skill} is listed in your CV.`,
          sourceEvidence: null,
        }),
      );
    }
  });

  const projects: ModelQuestion[] = [];
  const projectLines = cvLines(input.cvText)
    .filter((l) => PROJECT_LINE.test(l))
    .slice(0, 4);
  for (const [i, line] of projectLines.entries()) {
    const quote = clipWords(line, 200);
    projects.push(
      q(
        "PROJECT",
        i % 2 === 0
          ? `Your CV mentions: "${quote}". Walk me through the problem, your role, and the result.`
          : `About "${quote}" from your CV: what was the hardest decision you made, and what would you do differently now?`,
        {
          skill: null,
          source: "CV",
          sourceReason: "This work appears in your CV.",
          sourceEvidence: quote,
        },
      ),
    );
  }

  const behavioral = BEHAVIORAL.map((text) =>
    q("BEHAVIORAL", text, {
      skill: null,
      source: "GENERAL",
      sourceReason: "A standard behavioral question that shows how you work.",
      sourceEvidence: null,
    }),
  );
  const hr = HR.map((text) =>
    q("HR", text, {
      skill: null,
      source: "GENERAL",
      sourceReason: "A common general interview question.",
      sourceEvidence: null,
    }),
  );

  const pools: Pool[] = [
    { focus: "MISSING_SKILLS", items: gaps },
    { focus: "JOB_REQUIREMENTS", items: jobQs },
    { focus: "TECHNICAL_DEPTH", items: [...technical, ...jobQs] },
    { focus: "PROJECTS", items: projects },
    { focus: "OTHER", items: cvSkills },
    { focus: "BEHAVIORAL", items: behavioral },
    { focus: "GENERAL", items: hr },
  ];

  // Like the real prompt asks: only kinds that fit the interview type.
  const allowed = KINDS_BY_TYPE[input.config.type];
  for (const pool of pools) pool.items = pool.items.filter((item) => allowed.includes(item.kind));

  // Focus pool first and weighted double; the rest round-robin for variety.
  const ordered = [...pools].sort(
    (a, b) => Number(b.focus === input.config.focus) - Number(a.focus === input.config.focus),
  );
  const cursors = ordered.map(() => 0);
  const picked: ModelQuestion[] = [];
  const seen = new Set<string>();
  const wanted = input.config.questionCount + 6;
  for (let round = 0; picked.length < wanted && round < 40; round++) {
    ordered.forEach((pool, i) => {
      const take = i === 0 ? 2 : 1;
      for (let k = 0; k < take; k++) {
        const item = pool.items[cursors[i]!];
        if (!item) return;
        cursors[i]! += 1;
        if (seen.has(item.question)) continue;
        seen.add(item.question);
        picked.push(item);
      }
    });
  }
  return { questions: picked.slice(0, 24) };
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "you",
  "your",
  "with",
  "what",
  "how",
  "would",
  "about",
  "this",
  "that",
  "for",
  "from",
  "describe",
  "tell",
  "time",
]);

export function mockAnswerEvaluation(input: AnswerEvaluationInput): AnswerEvaluationOutput {
  const words = input.answer.trim().split(/\s+/).filter(Boolean);
  const answerText = input.answer.toLowerCase();
  const keywords = [
    ...(input.question.skill ? [input.question.skill.toLowerCase()] : []),
    ...input.question.prompt
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w)),
  ];
  const overlap =
    keywords.length === 0
      ? 0
      : keywords.filter((k) => answerText.includes(k)).length / keywords.length;
  const technical = input.question.kind !== "BEHAVIORAL" && input.question.kind !== "HR";
  const topic = input.question.skill ?? "the question";

  if (words.length < 12) {
    return {
      verdict: "WEAK_EVIDENCE",
      technicalAccuracy: technical ? 3 : null,
      relevance: overlap > 0 ? 5 : 3,
      completeness: 2,
      clarity: 5,
      communication: 5,
      evidence: 2,
      strengths: ["The answer is direct and to the point."],
      missingPoints: [
        `A concrete example of ${topic} in practice`,
        "The outcome or result of your work",
      ],
      accuracyNote: technical ? "The answer is too brief to judge its technical depth." : null,
      improvement:
        "Expand the answer with one specific example: the situation, what you did, and the result.",
      feedback:
        "Mock evaluation: the answer is very short, so there isn't enough evidence to judge it fully.",
      followUp: {
        question: `Could you walk me through one specific example related to ${topic}, including what you did and the result?`,
        reason:
          "The first answer was brief; a concrete example shows your experience more clearly.",
      },
    };
  }
  if (words.length < 40) {
    return {
      verdict: "PARTIAL",
      technicalAccuracy: technical ? 6 : null,
      relevance: overlap >= 0.3 ? 7 : 6,
      completeness: 5,
      clarity: 6,
      communication: 6,
      evidence: 4,
      strengths: ["The answer addresses the question.", "The main idea is easy to follow."],
      missingPoints: ["More detail on how you approached it", "A measurable result or outcome"],
      accuracyNote: technical
        ? "Nothing inaccurate stands out, but key details are missing."
        : null,
      improvement: "Add the reasoning behind your choices and finish with the result you achieved.",
      feedback:
        "Mock evaluation: a reasonable start that covers some important points but leaves others out.",
      followUp: null,
    };
  }
  return {
    verdict: "STRONG",
    technicalAccuracy: technical ? 8 : null,
    relevance: overlap >= 0.3 ? 9 : 8,
    completeness: 8,
    clarity: 8,
    communication: 8,
    evidence: 7,
    strengths: [
      "The answer is relevant and well structured.",
      "It explains the approach and gives concrete detail.",
    ],
    missingPoints: ["A brief reflection on what you would improve next time"],
    accuracyNote: technical ? "The technical content is consistent with the question." : null,
    improvement: "Close with one sentence on what you learned or would do differently.",
    feedback:
      "Mock evaluation: a detailed answer that covers the question with specific supporting detail.",
    followUp: null,
  };
}
