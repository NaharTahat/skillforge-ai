import { z } from "zod";
import { careerGoalValues, experienceLevelValues } from "@/lib/profile/options";
import { emailSchema } from "@/lib/validations/auth";

/** Empty strings from form inputs become null ("not set"). */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .transform((v) => (v === "" ? null : v));

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(50, `${label} must be at most 50 characters`);

export const profileSchema = z.object({
  firstName: requiredName("First name"),
  lastName: requiredName("Last name"),
  displayName: optionalText(60, "Display name"),
  email: emailSchema,
  /** Required by the server only when the email changes on a password account. */
  currentPassword: z.string().max(128).optional(),
  image: z
    .string()
    .trim()
    .max(2048, "Image URL is too long")
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use an https:// image URL")
    .transform((v) => (v === "" ? null : v)),
  careerGoal: z.union([z.enum(careerGoalValues), z.literal("")]).transform((v) => v || null),
  experienceLevel: z
    .union([z.enum(experienceLevelValues), z.literal("")])
    .transform((v) => v || null),
  location: optionalText(100, "Location"),
  bio: optionalText(600, "Bio"),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;
