import type { CvModelOutput } from "./analysis-schema";

/**
 * Grounding check: model claims must be traceable to the extracted CV text.
 * Matching is done on a normalized form (case, punctuation and whitespace
 * insensitive) so small quoting differences don't cause false rejections.
 */
export function normalizeForMatch(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    // Keep dots only inside tokens ("next.js", "3.5"); sentence-final dots would
    // otherwise stop "…with Docker." from matching "Docker".
    .replace(/\.+(?=\s|$)/g, "")
    .replace(/(^|\s)\.+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/**
 * True when every fragment of a quote appears in the CV. Quotes may elide text
 * with "..." / "…"; each non-trivial fragment must still be present.
 */
export function evidenceAppearsIn(evidence: string, normalizedCv: string): boolean {
  const fragments = evidence
    .split(/\.{3}|…/)
    .map(normalizeForMatch)
    .filter((f) => f.trim().length >= 3);
  return fragments.length > 0 && fragments.every((f) => normalizedCv.includes(f));
}

/** Skill names are matched as whole terms ("Go" must not match "good"). */
export function termAppearsIn(term: string, normalizedCv: string): boolean {
  const normalized = normalizeForMatch(term);
  return normalized.trim().length > 0 && normalizedCv.includes(normalized);
}

export type GroundedOutput = Omit<CvModelOutput, "skills"> & {
  skills: (CvModelOutput["skills"][number] & { verified: boolean })[];
  removedSkills: number;
  removedStrengths: number;
};

/**
 * - A skill is kept if its evidence quote or its name appears in the CV;
 *   `verified` records whether the quoted evidence itself was found.
 * - A strength is kept only if its evidence appears in the CV.
 * - Gaps and recommendations describe absence/advice and need no quote.
 */
export function groundAnalysis(output: CvModelOutput, cvText: string): GroundedOutput {
  const cv = normalizeForMatch(cvText);

  const traceable = output.skills
    .map((skill) => ({ ...skill, verified: evidenceAppearsIn(skill.evidence, cv) }))
    .filter((skill) => skill.verified || termAppearsIn(skill.name, cv));

  const seen = new Set<string>();
  const skills = traceable.filter((skill) => {
    const key = skill.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const strengths = output.strengths.filter((s) => evidenceAppearsIn(s.evidence, cv));

  return {
    ...output,
    skills,
    strengths,
    removedSkills: output.skills.length - traceable.length,
    removedStrengths: output.strengths.length - strengths.length,
  };
}
