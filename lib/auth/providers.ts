import "server-only";

/** Google sign-in is shown only when both OAuth credentials are configured. */
export function isGoogleAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}
