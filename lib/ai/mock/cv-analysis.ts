import { SKILL_CATEGORY_LABELS, type CvModelOutput } from "@/lib/cv/analysis-schema";
import { SCORE_DIMENSIONS, type DimensionKey } from "@/lib/cv/scoring";
import { SKILL_RULES } from "./skill-rules";

/**
 * Deterministic, rule-based stand-in for AI CV analysis (AI_PROVIDER=mock).
 * It only reports what simple pattern matching finds in the text, so it stays
 * grounded — but it is NOT an AI assessment and is labelled as such in the UI.
 */

const SECTION_PATTERNS: Record<keyof CvModelOutput["sections"], RegExp> = {
  contact: /^(contact|contact information|personal details)\b/im,
  summary: /^(summary|profile|professional summary|about me|objective)\b/im,
  education: /^(education|academic background|qualifications)\b/im,
  experience: /^(experience|work experience|professional experience|employment|work history)\b/im,
  skills: /^(skills|technical skills|core skills|competencies)\b/im,
  projects: /^(projects|personal projects|selected projects)\b/im,
  certifications: /^(certifications?|licenses? (and|&) certifications?|courses)\b/im,
};

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /\+?\d[\d\s().-]{7,}\d/;
const QUANTIFIED =
  /\b\d+(\.\d+)?\s?(%|percent|k\b|m\b|users|customers|x\b|ms\b|hours|million|thousand)/i;

/** The first line matching `pattern`, without bullet markers, as a verbatim quote. */
function lineContaining(lines: string[], pattern: RegExp): string {
  const line = (lines.find((l) => pattern.test(l)) ?? "").replace(/^[-•*▪◦]\s*/, "");
  return line.length > 280 ? line.slice(0, 280) : line;
}

function clamp(n: number) {
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function mockCvAnalysis(cvText: string): CvModelOutput {
  const lines = cvText.split("\n").filter((l) => l.trim().length > 0);

  const skills = SKILL_RULES.filter((rule) => rule.pattern.test(cvText)).map((rule) => ({
    name: rule.name,
    category: rule.category,
    evidence: lineContaining(lines, rule.pattern),
    confidence: 0.6,
  }));

  const sections = Object.fromEntries(
    Object.entries(SECTION_PATTERNS).map(([key, pattern]) => [key, pattern.test(cvText)]),
  ) as CvModelOutput["sections"];
  if (EMAIL.test(cvText) || PHONE.test(cvText)) sections.contact = true;

  const sectionCount = Object.values(sections).filter(Boolean).length;
  const quantifiedLines = lines.filter((l) => QUANTIFIED.test(l));
  const avgLineLength = lines.reduce((s, l) => s + l.length, 0) / Math.max(1, lines.length);
  const bulletLines = lines.filter((l) => /^[-•*▪◦]/.test(l)).length;

  const ratings: Record<DimensionKey, number> = {
    structure: clamp(sectionCount * 1.4),
    content: clamp(3 + quantifiedLines.length * 1.5),
    skills: clamp(skills.length * 0.8 + (sections.skills ? 2 : 0)),
    experience: sections.experience ? clamp(5 + quantifiedLines.length) : 1,
    education: sections.education ? 7 : 1,
    projects: sections.projects ? 7 : 1,
    atsReadiness: clamp(
      (sections.contact ? 3 : 0) + (sections.skills ? 3 : 0) + (sections.experience ? 3 : 0) + 1,
    ),
  };

  const missingSections = (Object.keys(sections) as (keyof typeof sections)[]).filter(
    (key) => !sections[key],
  );

  const gaps: CvModelOutput["gaps"] = missingSections.slice(0, 6).map((key) => ({
    area: `${key[0]!.toUpperCase()}${key.slice(1)} section`,
    type: "NOT_SPECIFIED",
    detail: `No "${key}" heading was found by the rule-based check.`,
  }));
  if (quantifiedLines.length === 0) {
    gaps.push({
      area: "Quantified achievements",
      type: "WEAK",
      detail: "No numbers or measurable results were found.",
    });
  }

  const recommendations: CvModelOutput["recommendations"] = [];
  if (quantifiedLines.length === 0) {
    recommendations.push({
      priority: "HIGH",
      title: "Quantify your impact",
      detail: "Add measurable outcomes (percentages, users, time saved) to your experience.",
    });
  }
  for (const key of missingSections.slice(0, 3)) {
    recommendations.push({
      priority: key === "experience" || key === "skills" ? "HIGH" : "MEDIUM",
      title: `Add a clear "${key}" section`,
      detail: `A labelled ${key} section helps both recruiters and ATS parsers.`,
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: "LOW",
      title: "Tailor keywords per application",
      detail: "Mirror the wording of each job description where it truthfully applies.",
    });
  }

  const strengths: CvModelOutput["strengths"] = [];
  const quantified = quantifiedLines[0] ? lineContaining([quantifiedLines[0]], /./) : null;
  if (quantified) strengths.push({ title: "Uses measurable results", evidence: quantified });
  // A second strength from a different line than the first.
  const skillStrength = skills.find((s) => s.evidence && s.evidence !== quantified);
  if (skillStrength) {
    strengths.push({
      title: `Shows ${skillStrength.name} experience`,
      evidence: skillStrength.evidence,
    });
  }

  const topCategory = skills[0] ? SKILL_CATEGORY_LABELS[skills[0].category] : null;

  return {
    summary: `Mock analysis (rule-based development provider): found ${skills.length} known skill keywords and ${sectionCount} of 7 standard sections. This is not an AI assessment.`,
    candidateProfile: {
      targetRoles: [],
      experienceLevel: "NOT_SPECIFIED",
      primaryDomain: topCategory,
      yearsOfExperience: null,
    },
    skills,
    strengths,
    gaps,
    recommendations,
    sections,
    formatting: {
      readability: clamp(avgLineLength > 140 ? 4 : 8),
      consistency: clamp(bulletLines > 2 ? 8 : 5),
      structure: ratings.structure,
    },
    dimensions: Object.fromEntries(
      SCORE_DIMENSIONS.map((d) => [
        d.key,
        {
          rating: ratings[d.key],
          rationale: `Mock rule-based rating for ${d.label.toLowerCase()} (keyword and heading checks only).`,
        },
      ]),
    ) as CvModelOutput["dimensions"],
  };
}
