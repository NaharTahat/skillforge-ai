import { evidenceAppearsIn, normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";
import type { ModelSkillGap, RoadmapModelOutput } from "./schema";
import { skillKey } from "./prioritization";

/**
 * Grounding for roadmaps:
 *  - STRONG / DEVELOPING need a CV quote that really appears in the CV. If it
 *    can't be verified, the gap becomes DEVELOPING when the skill is at least
 *    named in the CV, otherwise NOT_DEMONSTRATED.
 *  - NOT_DEMONSTRATED is raised to DEVELOPING when the CV names the skill.
 *  - Job roadmaps: every gap must be traceable to the job — a verified quote
 *    from the job description, a Job Match requirement, or the skill named in
 *    the job text. Untraceable gaps are dropped.
 *  - Career-goal roadmaps have no job text: gaps are role-typical, so
 *    requirementKind and targetEvidence are cleared.
 *  - Current-profile items must be found in the CV; the rest are dropped.
 */

const REASONS = {
  unverified: "Mentioned in your CV, but without text that clearly shows the level of experience.",
  notDemonstrated: "Not demonstrated in your CV.",
  mentioned: "Named in your CV, but not clearly demonstrated — worth strengthening.",
} as const;

export type GroundingContext = {
  cvText: string;
  /** Job description (job roadmaps) or null (career-goal roadmaps). */
  jobText: string | null;
  /** Requirement terms from the Job Match report (job roadmaps). */
  jobRequirementTerms: string[];
};

export type GroundedGap = ModelSkillGap & { adjusted: boolean };

export function groundRoadmap(output: RoadmapModelOutput, context: GroundingContext) {
  const cv = normalizeForMatch(context.cvText);
  const job = context.jobText === null ? null : normalizeForMatch(context.jobText);
  const requirementTerms = new Set(context.jobRequirementTerms.map(skillKey));

  let removedGaps = 0;
  let adjustedGaps = 0;
  const seen = new Set<string>();
  const skillGaps: GroundedGap[] = [];

  for (const gap of output.skillGaps) {
    const key = skillKey(gap.skill);
    if (seen.has(key)) continue;
    seen.add(key);

    const next: GroundedGap = { ...gap, adjusted: false };
    const cvQuoteOk = gap.cvEvidence !== null && evidenceAppearsIn(gap.cvEvidence, cv);
    const namedInCv = termAppearsIn(gap.skill, cv);

    if (gap.status !== "NOT_DEMONSTRATED" && !cvQuoteOk) {
      next.cvEvidence = null;
      next.status = namedInCv ? "DEVELOPING" : "NOT_DEMONSTRATED";
      next.reason = namedInCv ? REASONS.unverified : REASONS.notDemonstrated;
      next.adjusted = true;
    } else if (gap.status === "NOT_DEMONSTRATED") {
      next.cvEvidence = null;
      if (namedInCv) {
        next.status = "DEVELOPING";
        next.reason = REASONS.mentioned;
        next.adjusted = true;
      }
    }

    if (job === null) {
      next.requirementKind = null;
      next.targetEvidence = null;
    } else {
      const jobQuoteOk = gap.targetEvidence !== null && evidenceAppearsIn(gap.targetEvidence, job);
      if (!jobQuoteOk) next.targetEvidence = null;
      const traceable = jobQuoteOk || requirementTerms.has(key) || termAppearsIn(gap.skill, job);
      // A strength needn't come from the job; a gap must.
      if (!traceable && next.status !== "STRONG") {
        removedGaps++;
        continue;
      }
    }

    if (next.adjusted) adjustedGaps++;
    skillGaps.push(next);
  }

  const profile = output.currentProfile;
  const quoted = (items: string[]) => items.filter((item) => evidenceAppearsIn(item, cv));
  const named = (items: string[]) => items.filter((item) => termAppearsIn(item, cv));
  const currentProfile = {
    education: quoted(profile.education),
    strongSkills: named(profile.strongSkills),
    developingSkills: named(profile.developingSkills),
    technologies: named(profile.technologies),
    relevantProjects: quoted(profile.relevantProjects),
  };
  const removedProfileItems =
    Object.values(profile).reduce((sum, list) => sum + list.length, 0) -
    Object.values(currentProfile).reduce((sum, list) => sum + list.length, 0);

  return { skillGaps, currentProfile, removedGaps, adjustedGaps, removedProfileItems };
}
