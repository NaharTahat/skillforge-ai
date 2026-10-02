export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

/**
 * Accept only same-origin relative paths as post-login destinations to prevent
 * open redirects (e.g. `//evil.com`, `https://evil.com`, `/\evil.com`).
 */
export function safeRedirectPath(value: unknown, fallback: string = DEFAULT_LOGIN_REDIRECT) {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
