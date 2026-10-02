import { skillKey } from "@/lib/roadmap/prioritization";
import { CATEGORY_LABELS, PERFORMANCE_LABELS } from "./constants";
import type { CategoryScore, Insight, ResultAnalysis, SkillScore, StoredInsights } from "./schema";
import { supportedSkill } from "./skills";

/**
 * Result insights.
 *  - AI analysis is grounded: every item must be about a tested skill (or general),
 *    may not contain numbers/statistics (all numbers come from code), and may not
 *    claim anything about the user beyond the results.
 *  - When the AI is unavailable or returns nothing usable, deterministic rule-based
 *    insights are used instead.
 *  - Roadmap recommendations are deterministic: weak skills are matched to the user's
 *    existing roadmap tasks (read-only — the roadmap is never modified).
 */

const STATISTIC =
  /\d+(\.\d+)?\s*(%|percent|\/\s*\d+|out of\s*\d+|points?\b)|\b\d+\s+(questions?|answers?)\b/i;
const UNSAFE =
  /\b(stupid|lazy|incompetent|unintelligent|you lack|you don't know|guarantee|guaranteed|hired|employable)\b/i;

const clean = (text: string) => !STATISTIC.test(text) && !UNSAFE.test(text);

export type ReviewCandidate = { skill: string; prompt: string; points: number | null };

export function groundAnalysis(
  analysis: ResultAnalysis,
  testedSkills: string[],
): StoredInsights | null {
  const tested = new Set(testedSkills.map(skillKey));
  const okSkill = (skill: string | null) => {
    if (skill === null) return true;
    const canonical = supportedSkill(skill);
    return canonical !== null && tested.has(skillKey(canonical));
  };
  const keep = (items: Insight[]) => {
    const seen = new Set<string>();
    return items
      .filter((i) => okSkill(i.skill) && clean(i.text))
      .map((i) => ({ skill: i.skill ? supportedSkill(i.skill) : null, text: i.text.trim() }))
      .filter((i) => {
        const key = i.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };
  const result: StoredInsights = {
    strengths: keep(analysis.strengths),
    improvementAreas: keep(analysis.improvementAreas),
    recommendations: keep(analysis.recommendations),
    reviewTopics: analysis.reviewTopics
      .filter((t) => okSkill(t.skill) && clean(t.topic))
      .map((t) => ({ skill: supportedSkill(t.skill)!, topic: t.topic.trim() })),
  };
  return result.strengths.length + result.improvementAreas.length === 0 ? null : result;
}

/** Questions scoring below 0.6 points (including skipped ones) are review candidates. */
export function reviewTopicsFrom(candidates: ReviewCandidate[]): StoredInsights["reviewTopics"] {
  return candidates
    .filter((c) => (c.points ?? 0) < 0.6)
    .slice(0, 8)
    .map((c) => ({
      skill: c.skill,
      topic: c.prompt.length > 140 ? `${c.prompt.slice(0, 137).trimEnd()}…` : c.prompt,
    }));
}

/** Deterministic fallback insights from the computed scores. */
export function ruleInsights(
  skills: SkillScore[],
  categories: CategoryScore[],
  candidates: ReviewCandidate[],
): StoredInsights {
  const strong = skills.filter((s) => s.level === "STRONG" || s.level === "COMPETENT");
  const weak = skills.filter((s) => s.level === "DEVELOPING" || s.level === "NEEDS_IMPROVEMENT");
  const bestCategory = [...categories].sort((a, b) => b.percentage - a.percentage)[0];
  const worstCategory = [...categories].sort((a, b) => a.percentage - b.percentage)[0];
  const strengths: Insight[] = strong.map((s) => ({
    skill: s.skill,
    text: `${s.skill}: ${PERFORMANCE_LABELS[s.level].toLowerCase()} performance on the questions in this assessment.`,
  }));
  if (bestCategory && bestCategory.percentage >= 70) {
    strengths.push({
      skill: null,
      text: `Consistent results on ${CATEGORY_LABELS[bestCategory.category].toLowerCase()} questions.`,
    });
  }
  const improvementAreas: Insight[] = weak.map((s) => ({
    skill: s.skill,
    text: `${s.skill}: review the topics you missed and practice similar questions.`,
  }));
  if (worstCategory && worstCategory.percentage < 70 && worstCategory !== bestCategory) {
    improvementAreas.push({
      skill: null,
      text: `Strengthen ${CATEGORY_LABELS[worstCategory.category].toLowerCase()} — these questions had the lowest results.`,
    });
  }
  return {
    strengths,
    improvementAreas,
    recommendations: weak.map((s) => ({
      skill: s.skill,
      text: `Practice ${s.skill} with a short, focused exercise, then take another ${s.skill} assessment.`,
    })),
    reviewTopics: reviewTopicsFrom(candidates),
  };
}

/**
 * Deterministic roadmap links for weak skills. A weak skill that matches an
 * unfinished roadmap task points to that task; otherwise a practice suggestion
 * is given. The roadmap itself is never changed.
 */
export function roadmapRecommendations(
  skills: SkillScore[],
  roadmapTasks: { title: string; skill: string; status: string }[],
): Insight[] {
  const out: Insight[] = [];
  for (const s of skills.filter((x) => x.percentage < 70)) {
    const task = roadmapTasks.find(
      (t) =>
        t.status !== "COMPLETED" &&
        (skillKey(t.skill) === skillKey(s.skill) || skillKey(t.title).includes(skillKey(s.skill))),
    );
    out.push(
      task
        ? {
            skill: s.skill,
            text: `Review “${task.title}” in your Career Roadmap before continuing.`,
          }
        : {
            skill: s.skill,
            text: `${s.skill} isn't in your roadmap yet — practice it with a short exercise, then retake a ${s.skill} assessment.`,
          },
    );
  }
  return out;
}

export function mergeRecommendations(...lists: Insight[][]): Insight[] {
  const seen = new Set<string>();
  const out: Insight[] = [];
  for (const item of lists.flat()) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 8);
}
