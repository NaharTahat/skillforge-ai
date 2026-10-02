import { z } from "zod";

/** Shared by the client form and the server action; the server always re-validates. */

export const JOB_DESCRIPTION_MIN = 100;
export const JOB_DESCRIPTION_MAX = 20_000;

const optionalField = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform((v) => (v === "" ? null : v));

/** Removes control characters (keeps newlines/tabs) and normalizes line endings. */
export function cleanJobDescription(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export const jobMatchInputSchema = z.object({
  cvId: z
    .string()
    .min(1, "Select a CV")
    .max(40)
    .regex(/^[a-z0-9]+$/i, "Select a CV"),
  jobTitle: optionalField(120, "Job title"),
  company: optionalField(120, "Company"),
  location: optionalField(120, "Location"),
  jobUrl: z
    .string()
    .trim()
    .max(2048, "Job URL is too long")
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Use a full http(s):// link")
    .refine((v) => {
      if (v === "") return true;
      try {
        return ["http:", "https:"].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }, "Use a full http(s):// link")
    .transform((v) => (v === "" ? null : v)),
  jobDescription: z
    .string()
    .transform(cleanJobDescription)
    .pipe(
      z
        .string()
        .min(
          JOB_DESCRIPTION_MIN,
          `The job description is too short — paste at least ${JOB_DESCRIPTION_MIN} characters so requirements can be identified.`,
        )
        .max(
          JOB_DESCRIPTION_MAX,
          `The job description is too long (max ${JOB_DESCRIPTION_MAX.toLocaleString("en")} characters). Remove boilerplate such as benefits or company history.`,
        ),
    ),
});

export type JobMatchInput = z.input<typeof jobMatchInputSchema>;
export type JobMatchData = z.output<typeof jobMatchInputSchema>;
