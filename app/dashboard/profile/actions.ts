"use server";

import { revalidatePath } from "next/cache";
import { validationFailure, type ActionResult } from "@/lib/actions/result";
import { verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { logSecurityEvent } from "@/lib/security/audit-log";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { profileSchema } from "@/lib/validations/profile";

const EMAIL_IN_USE = "This email is already used by another account.";
// Current-password checks (email change) per user.
const reauthLimiter = createRateLimiter({ name: "reauth", limit: 5, windowMs: 15 * 60_000 });

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  // Identity comes from the session only; the input carries no user id.
  const user = await requireUser();

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { currentPassword, email, displayName, firstName, lastName, image, ...profile } =
    parsed.data;

  const emailChanged = email !== user.email;
  if (emailChanged) {
    if (user.hasPassword) {
      if (!currentPassword) {
        return {
          ok: false,
          fieldErrors: { currentPassword: "Enter your current password to change your email." },
        };
      }
      // A stolen session must not become a password-guessing oracle.
      const limit = await reauthLimiter(user.id);
      if (!limit.ok) {
        const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
        return {
          ok: false,
          fieldErrors: { currentPassword: `Too many attempts. Try again in ${minutes} minutes.` },
        };
      }
      const { passwordHash } = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
        logSecurityEvent("auth.reauth_failed", { user: user.id });
        return { ok: false, fieldErrors: { currentPassword: "Incorrect password." } };
      }
    }
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) return { ok: false, fieldErrors: { email: EMAIL_IN_USE } };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          firstName,
          lastName,
          name: displayName,
          image,
          email,
          // A changed address hasn't been verified by anyone yet.
          ...(emailChanged && { emailVerified: null }),
        },
      }),
      prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...profile },
        update: profile,
      }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, fieldErrors: { email: EMAIL_IN_USE } };
    }
    console.error("updateProfileAction: update failed");
    return { ok: false, error: "We couldn't save your profile. Please try again." };
  }

  // Header (name/avatar) lives in the dashboard layout.
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}
