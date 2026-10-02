import "server-only";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { clientIpFromHeaders } from "./client-ip";

/**
 * CSRF defence for cookie-authenticated Route Handlers (Server Actions get this
 * from Next.js). Browsers always send Origin on cross-site POSTs; it must match
 * the host this request was addressed to.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Client IP for rate limiting, from the header the deployment trusts
 * (CLIENT_IP_HEADER / TRUSTED_PROXY_HOPS); never the client-supplied part.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const env = getEnv();
  return clientIpFromHeaders((name) => h.get(name), {
    header: env.CLIENT_IP_HEADER,
    trustedHops: env.TRUSTED_PROXY_HOPS,
  });
}
