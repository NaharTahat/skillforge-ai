import { evidenceAppearsIn, normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";
import type { JobMatchModelOutput, ReportRequirement } from "./schema";

/**
 * Deterministic checks on the model's comparison:
 *  - A requirement must be quoted from the job description, or it is dropped.
 *  - PRESENT / PARTIAL need a CV quote that really appears in the CV. If the
 *    quote can't be verified, the level is corrected (PARTIAL if the term is
 *    at least mentioned in the CV, otherwise MISSING).
 *  - A requirement marked MISSING whose term does appear in the CV is raised
 *    to PARTIAL: "not clearly shown" must not be reported as "absent".
 *  - Keywords must appear in the job description; coverage is computed here.
 */

const CORRECTED = {
  toPartialUnverified:
    "Mentioned in your CV, but the analysis couldn't point to text that clearly shows this.",
  toMissing: "No supporting evidence was found in your CV text.",
  toPartialMentioned:
    "The term appears in your CV, but it isn't clear that it meets this requirement.",
} as const;

// Experience/education requirements are phrases ("5+ years", "Bachelor's degree");
// finding their words in a CV says little, so they aren't raised by term matching.
const TERM_UPGRADE_EXCLUDED = new Set(["EXPERIENCE", "EDUCATION"]);

export type GroundedJobMatch = Omit<JobMatchModelOutput, "requirements" | "keywords"> & {
  requirements: ReportRequirement[];
  keywordCoverage: { matched: string[]; missing: string[] };
  removedRequirements: number;
  adjustedRequirements: number;
};

export function groundJobMatch(
  output: JobMatchModelOutput,
  cvText: string,
  jobText: string,
): GroundedJobMatch {
  const cv = normalizeForMatch(cvText);
  const job = normalizeForMatch(jobText);

  const inJob = output.requirements.filter((r) => evidenceAppearsIn(r.evidenceFromJob, job));
  let adjusted = 0;

  const seen = new Set<string>();
  const requirements: ReportRequirement[] = [];
  for (const r of inJob) {
    const key = `${r.kind}:${r.term.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cvQuoteOk = r.evidenceFromCv !== null && evidenceAppearsIn(r.evidenceFromCv, cv);
    const termInCv = termAppearsIn(r.term, cv);
    const next: ReportRequirement = { ...r, adjusted: false };

    if (r.match !== "MISSING" && !cvQuoteOk) {
      next.evidenceFromCv = null;
      next.match = termInCv ? "PARTIAL" : "MISSING";
      next.explanation = termInCv ? CORRECTED.toPartialUnverified : CORRECTED.toMissing;
      next.adjusted = true;
    } else if (r.match === "MISSING") {
      next.evidenceFromCv = null;
      if (termInCv && !TERM_UPGRADE_EXCLUDED.has(r.category)) {
        next.match = "PARTIAL";
        next.explanation = CORRECTED.toPartialMentioned;
        next.adjusted = true;
      }
    }
    if (next.adjusted) adjusted++;
    requirements.push(next);
  }

  // De-duplicate case-insensitively, keeping the first spelling.
  const firstSpelling = new Map<string, string>();
  for (const k of output.keywords) {
    const key = k.trim().toLowerCase();
    if (!firstSpelling.has(key)) firstSpelling.set(key, k.trim());
  }
  const keywords = [...firstSpelling.values()].filter((k) => termAppearsIn(k, job));

  return {
    ...output,
    requirements,
    keywordCoverage: {
      matched: keywords.filter((k) => termAppearsIn(k, cv)),
      missing: keywords.filter((k) => !termAppearsIn(k, cv)),
    },
    removedRequirements: output.requirements.length - inJob.length,
    adjustedRequirements: adjusted,
  };
}
