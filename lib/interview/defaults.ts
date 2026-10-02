import type { Difficulty, Focus } from "./constants";

/**
 * Configuration defaults derived from the user's real data. Nothing is
 * inferred beyond what the profile or CV analysis states.
 */

const PROFILE_LEVEL_DIFFICULTY: Record<string, Difficulty> = {
  STUDENT: "ENTRY",
  FRESH_GRADUATE: "ENTRY",
  JUNIOR: "ENTRY",
  MID: "INTERMEDIATE",
  SENIOR: "ADVANCED",
};

const CV_LEVEL_DIFFICULTY: Record<string, Difficulty> = {
  STUDENT: "ENTRY",
  ENTRY: "ENTRY",
  JUNIOR: "ENTRY",
  MID: "INTERMEDIATE",
  SENIOR: "ADVANCED",
  LEAD: "ADVANCED",
};

/**
 * The profile's experience level wins, then the CV analysis level. When neither
 * states a level, Entry is used and the UI says the level is not specified.
 */
export function defaultDifficulty(
  profileLevel: string | null | undefined,
  cvLevel: string | null | undefined,
): { difficulty: Difficulty; basis: "profile" | "cv" | "not_specified" } {
  if (profileLevel && PROFILE_LEVEL_DIFFICULTY[profileLevel]) {
    return { difficulty: PROFILE_LEVEL_DIFFICULTY[profileLevel], basis: "profile" };
  }
  if (cvLevel && CV_LEVEL_DIFFICULTY[cvLevel]) {
    return { difficulty: CV_LEVEL_DIFFICULTY[cvLevel], basis: "cv" };
  }
  return { difficulty: "ENTRY", basis: "not_specified" };
}

/**
 * Highest-value focus for a Job Match interview:
 *  required requirements that are missing or partial → Missing skills;
 *  otherwise → Job requirements.
 */
export function recommendedFocus(
  requirements: { kind: "REQUIRED" | "PREFERRED"; match: "PRESENT" | "PARTIAL" | "MISSING" }[],
): Focus {
  return requirements.some((r) => r.kind === "REQUIRED" && r.match !== "PRESENT")
    ? "MISSING_SKILLS"
    : "JOB_REQUIREMENTS";
}
