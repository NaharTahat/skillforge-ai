import "server-only";
import { prisma } from "@/lib/db/prisma";
import { logSecurityEvent } from "@/lib/security/audit-log";

/**
 * Sign-out for stateless JWT sessions: the session's random id is recorded
 * until the token's own expiry, so a copied cookie stops working after logout.
 */

const SID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function revokeSession(sid: unknown, expiresAtSeconds: unknown) {
  if (typeof sid !== "string" || !SID_PATTERN.test(sid)) return;
  const expiresAt =
    typeof expiresAtSeconds === "number"
      ? new Date(expiresAtSeconds * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  await prisma.$transaction([
    // Rows past their token's expiry can't match a valid token any more.
    prisma.revokedSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.revokedSession.createMany({ data: [{ sid, expiresAt }], skipDuplicates: true }),
  ]);
  logSecurityEvent("auth.session_revoked");
}

export async function isSessionRevoked(sid: string | undefined): Promise<boolean> {
  // Sessions issued before revocation existed carry no sid; they expire on their own.
  if (!sid || !SID_PATTERN.test(sid)) return false;
  const row = await prisma.revokedSession.findUnique({ where: { sid }, select: { sid: true } });
  return row !== null;
}
