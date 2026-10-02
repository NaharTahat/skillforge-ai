/** Date display helpers for portfolio items. Dates are stored as UTC midnight, so format in UTC. */

const month = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const day = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonth(date: Date | string | null | undefined): string {
  if (!date) return "";
  return month.format(new Date(date));
}

export function formatDay(date: Date | string | null | undefined): string {
  if (!date) return "";
  return day.format(new Date(date));
}

/** Date → "YYYY-MM-DD" (UTC) for date inputs. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** "Jan 2023 – Present" / "Jan 2023 – Jun 2024" / null when no start date. */
export function formatRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
  ongoing = "Present",
): string | null {
  if (!start && !end) return null;
  if (!start) return formatMonth(end);
  return `${formatMonth(start)} – ${end ? formatMonth(end) : ongoing}`;
}
