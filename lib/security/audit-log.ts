import { createHash } from "node:crypto";

/**
 * Structured security-event log (one JSON line on stderr, ready for a log
 * pipeline). Events carry pseudonymous fingerprints and internal ids only —
 * never emails, IPs, passwords, tokens, document text or answers.
 */
export type SecurityEvent =
  | "rate_limit.exceeded"
  | "auth.password_reset_completed"
  | "auth.reauth_failed"
  | "auth.session_revoked"
  | "request.cross_origin_rejected";

type Detail = string | number | boolean | null;

/** Short, non-reversible fingerprint for correlating events without storing the value. */
export function fingerprint(value: string): string {
  return createHash("sha256").update(`skillforge:${value}`).digest("base64url").slice(0, 16);
}

export function logSecurityEvent(event: SecurityEvent, details: Record<string, Detail> = {}) {
  if (process.env.NODE_ENV === "test") return;
  console.warn(
    JSON.stringify({ type: "security", event, at: new Date().toISOString(), ...details }),
  );
}
