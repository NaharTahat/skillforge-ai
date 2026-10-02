/** URL slug from a title: lowercase ASCII letters/digits and single hyphens, max 60 chars. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "project";
}

/** First free slug: "my-app", then "my-app-2", "my-app-3", … */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 56)}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Skill slug for the shared Skill catalog (case-insensitive name identity). */
export function skillSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/#/g, "sharp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
