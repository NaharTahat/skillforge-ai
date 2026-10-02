import type { JobMatchModelOutput, Requirement } from "@/lib/job-match/schema";
import { SKILL_RULES } from "./skill-rules";

/**
 * Deterministic, rule-based stand-in for AI job matching (AI_PROVIDER=mock).
 * Requirements are known skill keywords found in the job description; each is
 * marked PRESENT when the same keyword appears in the CV. It is NOT an AI
 * assessment and is labelled as such in the UI.
 */

const PREFERRED_HEADING = /\b(preferred|nice to have|nice-to-have|bonus|plus|desirable)\b/i;
const REQUIRED_HEADING =
  /\b(requirements?|required|must have|must-have|qualifications|essential)\b/i;
const YEARS = /(\d{1,2})\s*\+?\s*(?:years|yrs)/i;
const DEGREE = /\b(bachelor|master|phd|degree|bsc|msc|b\.s\.|m\.s\.)\b/i;

function stripBullet(line: string) {
  return line
    .replace(/^[-•*▪◦]\s*/, "")
    .trim()
    .slice(0, 280);
}

/** Bullet lines under a "Responsibilities" / "What you'll do" heading. */
function responsibilityLines(jobLines: string[]): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const line of jobLines) {
    if (line.length < 60 && !/^[-•*▪◦]/.test(line)) {
      inSection = /\b(responsibilit|what you('|’)ll do|duties|the role)\w*/i.test(line);
      continue;
    }
    if (inSection && /^[-•*▪◦]/.test(line)) out.push(stripBullet(line));
  }
  return out.filter((l) => l.length > 0).slice(0, 5);
}

function clamp(n: number) {
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function mockJobMatch(cvText: string, jobDescription: string): JobMatchModelOutput {
  const jobLines = jobDescription
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const cvLines = cvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Track whether each line sits under a "preferred" heading.
  let inPreferred = false;
  const lineKinds = jobLines.map((line) => {
    if (line.length < 60 && PREFERRED_HEADING.test(line)) inPreferred = true;
    else if (line.length < 60 && REQUIRED_HEADING.test(line)) inPreferred = false;
    return inPreferred || /\b(nice to have|bonus|preferred|a plus)\b/i.test(line)
      ? ("PREFERRED" as const)
      : ("REQUIRED" as const);
  });

  const requirements: Requirement[] = [];
  for (const rule of SKILL_RULES) {
    const index = jobLines.findIndex((l) => rule.pattern.test(l));
    if (index === -1) continue;
    const kind = lineKinds[index]!;
    const cvLine = cvLines.find((l) => rule.pattern.test(l));
    requirements.push({
      requirement: stripBullet(jobLines[index]!).slice(0, 200),
      term: rule.name,
      kind,
      category:
        rule.category === "TOOLS" || rule.category === "CLOUD_DEVOPS" ? "TECHNOLOGY" : "SKILL",
      importance: kind === "REQUIRED" ? "IMPORTANT" : "NICE_TO_HAVE",
      evidenceFromJob: stripBullet(jobLines[index]!),
      match: cvLine ? "PRESENT" : "MISSING",
      evidenceFromCv: cvLine ? stripBullet(cvLine) : null,
      explanation: cvLine
        ? `Mock check: "${rule.name}" appears in both the job description and the CV.`
        : `Mock check: "${rule.name}" appears in the job description but not in the CV.`,
    });
  }

  const yearsLine = jobLines.find((l) => YEARS.test(l));
  const yearsMin = yearsLine ? Number(YEARS.exec(yearsLine)![1]) : null;
  const cvYears = Math.max(
    0,
    ...[...cvText.matchAll(/(\d{4})\s*[-–]\s*(\d{4}|present)/gi)].map((m) => {
      const end = /present/i.test(m[2]!) ? new Date().getUTCFullYear() : Number(m[2]);
      return end - Number(m[1]);
    }),
  );
  const degreeLine = jobLines.find((l) => DEGREE.test(l));

  const missing = requirements.filter((r) => r.match === "MISSING");
  const present = requirements.filter((r) => r.match === "PRESENT");

  return {
    summary: `Mock job match (rule-based development provider): ${present.length} of ${requirements.length} known skill keywords from the job description also appear in the CV. This is not an AI assessment.`,
    role: { title: null, seniority: "NOT_SPECIFIED" },
    requirements,
    responsibilities: responsibilityLines(jobLines),
    experienceRequirement: {
      yearsMin,
      description: yearsLine ? stripBullet(yearsLine).slice(0, 300) : null,
    },
    educationRequirement: {
      description: degreeLine ? stripBullet(degreeLine).slice(0, 300) : null,
    },
    keywords: requirements.map((r) => r.term),
    dimensions: {
      experience: {
        rating: yearsMin === null ? 5 : clamp((cvYears / yearsMin) * 8),
        rationale: "Mock rating from year ranges found in the CV (rule-based).",
      },
      education: {
        rating: DEGREE.test(cvText) ? 8 : 2,
        rationale: "Mock rating: checks whether the CV mentions a degree (rule-based).",
      },
      projects: {
        rating: /^projects?\b/im.test(cvText) ? 7 : 1,
        rationale: "Mock rating: checks for a projects section in the CV (rule-based).",
      },
    },
    strengths: present.slice(0, 3).map((r) => ({
      area: r.term,
      explanation: `The job asks for ${r.term} and the CV mentions it.`,
    })),
    recommendations: missing.slice(0, 4).map((r, i) => ({
      priority: i === 0 && r.kind === "REQUIRED" ? ("HIGH" as const) : ("MEDIUM" as const),
      recommendation: `If you have experience with ${r.term}, make it visible in your CV.`,
      reason: `The job description mentions ${r.term}, but the CV doesn't. Only add it if it's genuinely part of your experience.`,
    })),
    interviewTopics: requirements.slice(0, 5).map((r) => `${r.term} in practice`),
  };
}
