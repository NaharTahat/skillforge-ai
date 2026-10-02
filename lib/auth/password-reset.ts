import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const PREFIX = "password-reset:";

// Only the SHA-256 of the token is stored, so a database leak can't be used to reset passwords.
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a single-use token, replacing any outstanding one for this email. */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const identifier = PREFIX + email;
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashResetToken(token),
        expires: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** Returns the email the token was issued for, or null if invalid/expired. */
export async function findValidResetToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashResetToken(token), identifier: { startsWith: PREFIX } },
  });
  if (!record || record.expires < new Date()) return null;
  return record.identifier.slice(PREFIX.length);
}

export function resetTokenIdentifier(email: string) {
  return PREFIX + email;
}
