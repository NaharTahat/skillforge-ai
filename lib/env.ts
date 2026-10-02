import "server-only";
import { parseServerEnv, type ServerEnv } from "./env-schema";

/**
 * Server-side environment, validated once on first access (and at startup by
 * instrumentation.ts). Import `getEnv` only from server code — it contains secrets.
 */
export type { ServerEnv };

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  cached = parseServerEnv(process.env);
  return cached;
}
