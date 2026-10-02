/**
 * Client IP for rate limiting, resistant to header spoofing.
 *
 * Two trust models, chosen with CLIENT_IP_HEADER:
 *
 * - "x-forwarded-for" (default): clients can send their own X-Forwarded-For
 *   and each trusted reverse proxy appends the address it received the request
 *   from. With `trustedHops` proxies in front of the app, the real client is
 *   the `trustedHops`-th entry from the right; anything to its left is ignored.
 *
 * - "x-real-ip": a single header that the hosting platform's edge always sets
 *   itself (Railway documents X-Real-IP as the client's remote IP). Use it only
 *   on platforms that overwrite it; behind a proxy that passes it through
 *   unchanged, clients could forge it.
 *
 * Without a proxy, Next.js fills X-Forwarded-For from the socket only when the
 * client didn't send one, so the address can't be fully trusted there either;
 * per-account limits (keyed by email or user id) don't depend on it.
 */

const IP_PATTERN = /^[0-9a-f:.]{2,45}$/i;

export type ClientIpHeader = "x-forwarded-for" | "x-real-ip";

function valid(candidate: string | undefined): string {
  const value = candidate?.trim() ?? "";
  return IP_PATTERN.test(value) ? value.toLowerCase() : "unknown";
}

export function clientIpFrom(forwardedFor: string | null, trustedHops: number): string {
  const entries = (forwardedFor ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (entries.length === 0 || trustedHops <= 0) return "unknown";
  return valid(entries[Math.max(0, entries.length - trustedHops)]);
}

/** Reads the configured header from a header getter (Next.js `headers()` or a Request). */
export function clientIpFromHeaders(
  get: (name: string) => string | null,
  config: { header: ClientIpHeader; trustedHops: number },
): string {
  if (config.header === "x-real-ip") {
    // A platform-set single value; a comma means something appended to it — don't guess.
    const value = get("x-real-ip");
    return value && !value.includes(",") ? valid(value) : "unknown";
  }
  return clientIpFrom(get("x-forwarded-for"), config.trustedHops);
}
