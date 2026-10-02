/** Human label for a job match: "Title · Company", falling back gracefully. */
export function jobMatchLabel(job: { title: string | null; company: string | null }): string {
  const parts = [job.title, job.company].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Untitled job";
}
