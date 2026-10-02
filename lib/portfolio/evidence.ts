/**
 * Deterministic skill evidence. Evidence strength describes how much
 * SkillForge-recorded evidence supports a skill — it is not a measure of
 * real-world ability, and it never sets the user's self-assessed level.
 *
 * Assessment classification (latest assessment percentage for the skill):
 *   90–100 Strong evidence · 75–89 Good evidence · 60–74 Developing · < 60 Needs improvement
 *
 * Evidence points (capped at 100):
 *   assessment          Strong 40 · Good 30 · Developing 15 · Needs improvement 5
 *   projects            15 each, at most 2 counted (completed or in-progress projects only)
 *   certifications      15 each, at most 2 counted
 *   AI interview        15 when the average answer score on the skill is ≥ 70, otherwise 5
 *   CV analysis         10 when the skill is verified (quoted) in the latest CV analysis
 *   Job Match           5 when a job match shows the skill as present in the CV
 *   Career roadmap      5 per completed task on the skill, at most 2 counted
 *
 * Strength bands: ≥ 70 Strong · ≥ 40 Moderate · > 0 Limited · 0 Self-reported only
 */

export const ASSESSMENT_THRESHOLDS = [
  { min: 90, band: "STRONG", label: "Strong evidence", points: 40 },
  { min: 75, band: "GOOD", label: "Good evidence", points: 30 },
  { min: 60, band: "DEVELOPING", label: "Developing", points: 15 },
  { min: 0, band: "NEEDS_IMPROVEMENT", label: "Needs improvement", points: 5 },
] as const;

export type AssessmentBand = (typeof ASSESSMENT_THRESHOLDS)[number]["band"];

export function classifyAssessment(percentage: number) {
  return ASSESSMENT_THRESHOLDS.find((t) => percentage >= t.min)!;
}

export const STRENGTH_BANDS = [
  { min: 70, band: "STRONG", label: "Strong" },
  { min: 40, band: "MODERATE", label: "Moderate" },
  { min: 1, band: "LIMITED", label: "Limited" },
  { min: 0, band: "NONE", label: "Self-reported only" },
] as const;
export type StrengthBand = (typeof STRENGTH_BANDS)[number]["band"];

export type EvidenceCounts = {
  /** Latest assessment percentage on the skill, if any. */
  latestAssessment: number | null;
  projects: number;
  certifications: number;
  /** Average interview answer score (0–100) on the skill, if any answers were evaluated. */
  interviewAverage: number | null;
  cvVerified: boolean;
  jobMatchPresent: boolean;
  roadmapTasksCompleted: number;
};

export function evidenceStrength(e: EvidenceCounts) {
  let points = 0;
  if (e.latestAssessment !== null) points += classifyAssessment(e.latestAssessment).points;
  points += Math.min(2, e.projects) * 15;
  points += Math.min(2, e.certifications) * 15;
  if (e.interviewAverage !== null) points += e.interviewAverage >= 70 ? 15 : 5;
  if (e.cvVerified) points += 10;
  if (e.jobMatchPresent) points += 5;
  points += Math.min(2, e.roadmapTasksCompleted) * 5;
  const score = Math.min(100, points);
  const band = STRENGTH_BANDS.find((b) => score >= b.min)!;
  return { score, band: band.band as StrengthBand, label: band.label };
}
