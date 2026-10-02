import { normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";
import { skillsInText } from "@/lib/assessment/skills";

/**
 * Grounding checks for AI-written portfolio text. A sentence is only kept when
 * everything it claims can be traced to the user's own input:
 *  - every number in it appears in the source text (no invented metrics, years, counts);
 *  - every known technology/skill it names appears in the source text;
 *  - claims of employment, clients, users, revenue, awards or expertise appear
 *    only when the source text supports them.
 */

const NUMBER = /\d+(?:[.,]\d+)?/g;

export function numbersSupported(text: string, source: string): boolean {
  const known = new Set((source.match(NUMBER) ?? []).map((n) => n.replace(",", ".")));
  return (text.match(NUMBER) ?? []).every((n) => known.has(n.replace(",", ".")));
}

/** Catalog skills named in `text` that the source never mentions. */
export function unknownSkills(text: string, source: string): string[] {
  const normalizedSource = normalizeForMatch(source);
  return skillsInText(text).filter((s) => !termAppearsIn(s, normalizedSource));
}

/** Claim words that need explicit support in the source. */
const CLAIMS: { pattern: RegExp; support: RegExp }[] = [
  {
    pattern: /\b(work(?:ed|ing|s)? (?:at|for)|employed|intern(?:ed|ing)? at|joined)\b/i,
    support: /\b(at|company|employ|intern|worked|work)\b/i,
  },
  { pattern: /\b(clients?|customers?)\b/i, support: /\b(clients?|customers?)\b/i },
  { pattern: /\busers\b/i, support: /\busers\b/i },
  { pattern: /\b(revenue|profit|sales)\b/i, support: /\b(revenue|profit|sales)\b/i },
  {
    pattern: /\b(award(?:s|ed)?|award-winning|prize|won)\b/i,
    support: /\b(award|prize|won|winner|place)\b/i,
  },
  { pattern: /\b(years? of experience|seasoned|veteran)\b/i, support: /\byears?\b/i },
  {
    pattern: /\b(expert|world-class|renowned|leading|mastery)\b/i,
    support: /\b(expert|world-class|renowned|leading|mastery)\b/i,
  },
];

export function unsupportedClaim(text: string, source: string): boolean {
  return CLAIMS.some((c) => c.pattern.test(text) && !c.support.test(source));
}

/** All checks together: true when `text` stays within what `source` supports. */
export function isGrounded(text: string, source: string): boolean {
  return (
    numbersSupported(text, source) &&
    unknownSkills(text, source).length === 0 &&
    !unsupportedClaim(text, source)
  );
}
