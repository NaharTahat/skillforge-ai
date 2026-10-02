"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { validationFailure, type ActionResult } from "@/lib/actions/result";
import { signIn, signOut } from "@/lib/auth/auth";
import { hashPassword } from "@/lib/auth/password";
import {
  createPasswordResetToken,
  findValidResetToken,
  hashResetToken,
  resetTokenIdentifier,
} from "@/lib/auth/password-reset";
import { isGoogleAuthEnabled } from "@/lib/auth/providers";
import { DEFAULT_LOGIN_REDIRECT, safeRedirectPath } from "@/lib/auth/redirect";
import { siteConfig } from "@/lib/config/site";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { isMailAvailable, sendPasswordResetEmail } from "@/lib/mail";
import { fingerprint, logSecurityEvent } from "@/lib/security/audit-log";
import { createRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const MINUTE = 60_000;
// Per account (any IP): stops password guessing spread across many addresses.
const loginAccountLimiter = createRateLimiter({
  name: "login-account",
  limit: 10,
  windowMs: 15 * MINUTE,
});
// Per IP (any account): stops credential stuffing across many accounts.
const loginIpLimiter = createRateLimiter({ name: "login-ip", limit: 50, windowMs: 15 * MINUTE });
// Created lazily: the limit comes from validated runtime configuration.
let registerLimiterInstance: RateLimiter | undefined;
function registerLimiter(key: string) {
  registerLimiterInstance ??= createRateLimiter({
    name: "register-ip",
    limit: getEnv().AUTH_REGISTER_LIMIT_PER_HOUR,
    windowMs: 60 * MINUTE,
  });
  return registerLimiterInstance(key);
}
const resetIpLimiter = createRateLimiter({
  name: "password-reset-ip",
  limit: 5,
  windowMs: 15 * MINUTE,
});
// Per email: stops flooding one inbox with reset emails from many IPs.
const resetEmailLimiter = createRateLimiter({
  name: "password-reset-email",
  limit: 3,
  windowMs: 60 * MINUTE,
});

function tooManyAttempts(retryAfterSeconds: number): ActionResult {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    ok: false,
    error: `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  };
}

/** Auth.js signals success by throwing a redirect; only AuthErrors are failures. */
async function signInWithCredentials(email: string, password: string, redirectTo: string) {
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) return false;
    throw error;
  }
  return true;
}

export async function loginAction(input: unknown, callbackUrl?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { email, password } = parsed.data;
  // Both checks always run, so each counts every attempt.
  const [byAccount, byIp] = await Promise.all([
    loginAccountLimiter(email),
    loginIpLimiter(await getClientIp()),
  ]);
  if (!byAccount.ok) return tooManyAttempts(byAccount.retryAfterSeconds);
  if (!byIp.ok) return tooManyAttempts(byIp.retryAfterSeconds);

  const ok = await signInWithCredentials(email, password, safeRedirectPath(callbackUrl));
  // Same message whether the email exists or not (no account enumeration).
  return ok ? { ok: true } : { ok: false, error: "Invalid email or password." };
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const limit = await registerLimiter(await getClientIp());
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSeconds);

  const { firstName, lastName, email, password } = parsed.data;
  const emailTaken = {
    ok: false as const,
    fieldErrors: { email: "An account with this email already exists. Try signing in." },
  };

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return emailTaken;

  try {
    await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        passwordHash: await hashPassword(password),
        profile: { create: {} },
      },
      select: { id: true },
    });
  } catch (error) {
    // Unique violation from a concurrent registration with the same email.
    if ((error as { code?: string }).code === "P2002") return emailTaken;
    console.error("registerAction: failed to create user");
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }

  const signedIn = await signInWithCredentials(email, password, DEFAULT_LOGIN_REDIRECT);
  if (!signedIn) redirect("/login?registered=1");
  return { ok: true };
}

export async function googleSignInAction(callbackUrl?: string): Promise<ActionResult> {
  if (!isGoogleAuthEnabled()) {
    return { ok: false, error: "Google sign-in isn't available right now." };
  }
  await signIn("google", { redirectTo: safeRedirectPath(callbackUrl) });
  return { ok: true };
}

const RESET_REQUESTED =
  "If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour.";

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const limit = await resetIpLimiter(`${await getClientIp()}:forgot`);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSeconds);

  // Checked before any lookup, so the answer never depends on the email.
  if (!isMailAvailable()) {
    return {
      ok: false,
      error: "Password reset by email isn't available yet. Please contact support.",
    };
  }

  const { email } = parsed.data;
  // Over the per-email cap the response is unchanged (no enumeration); the email just isn't sent.
  const perEmail = await resetEmailLimiter(email);
  if (perEmail.ok) {
    // After the response: its timing must not reveal whether the account exists
    // (the lookup, token write and email call only happen for real accounts).
    after(async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { passwordHash: true },
        });
        if (!user?.passwordHash) return;
        const token = await createPasswordResetToken(email);
        await sendPasswordResetEmail(email, `${siteConfig.url}/reset-password?token=${token}`);
      } catch {
        console.error("[auth] password reset email could not be prepared");
      }
    });
  }
  return { ok: true, message: RESET_REQUESTED };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const limit = await resetIpLimiter(`${await getClientIp()}:reset`);
  if (!limit.ok) return tooManyAttempts(limit.retryAfterSeconds);

  const email = await findValidResetToken(parsed.data.token);
  if (!email) {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  // Single use: consuming the token and changing the password happen together,
  // and only the request that actually deleted the token may proceed.
  const changed = await prisma.$transaction(async (tx) => {
    const consumed = await tx.verificationToken.deleteMany({
      where: { identifier: resetTokenIdentifier(email), token: hashResetToken(parsed.data.token) },
    });
    if (consumed.count === 0) return false;
    // passwordChangedAt invalidates every session issued before now.
    await tx.user.update({
      where: { email },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    return true;
  });
  if (!changed) {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }
  logSecurityEvent("auth.password_reset_completed", { account: fingerprint(email) });

  redirect("/login?reset=success");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** Clears a stale session cookie (deleted user / password changed elsewhere). */
export async function clearSessionAction() {
  await signOut({ redirectTo: "/login" });
}
