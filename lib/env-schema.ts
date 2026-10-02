import path from "node:path";
import { z } from "zod";

/**
 * Server environment schema. Plain module (no "server-only") so startup
 * validation in instrumentation.ts can use it; import `getEnv` from
 * `@/lib/env` everywhere else.
 */

/** Values that must never be used as a production AUTH_SECRET. */
const PLACEHOLDER_SECRETS = /^(change[-_]?me|secret|test|(your|replace|generate|insert)[-_ ].*)$/i;

const isLocalHost = (url: string) => {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url(),
    /** Optional connection pool cap (pg default is 10). */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).optional(),
    /** Optional: close idle pool connections after this many ms (pg default 10000). */
    DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1).max(600_000).optional(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    AUTH_URL: z.url().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    /** Sign-ups allowed per IP per hour. */
    AUTH_REGISTER_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(10_000).default(10),
    /**
     * Reverse proxies in front of the app that append to X-Forwarded-For
     * (1 = one load balancer / Vercel / nginx). 0 = don't trust the header.
     */
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    /**
     * Where the client IP comes from: "x-forwarded-for" (with TRUSTED_PROXY_HOPS)
     * or "x-real-ip" on platforms whose edge always sets it (Railway).
     */
    CLIENT_IP_HEADER: z.enum(["x-forwarded-for", "x-real-ip"]).default("x-forwarded-for"),
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    /**
     * "resend" sends through the Resend API; "console" prints emails to the
     * server log (development/testing only); "none" disables email.
     */
    MAIL_TRANSPORT: z.enum(["resend", "console", "none"]).optional(),
    RESEND_API_KEY: z.string().optional(),
    /** Sender, e.g. "SkillForge AI <no-reply@your-domain>"; the domain must be verified with the provider. */
    MAIL_FROM: z
      .string()
      .regex(
        /^([^<>]{1,80} <)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/,
        "Use an email address or Name <email>",
      )
      .optional(),
    AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(600_000).default(120_000),
    STORAGE_DRIVER: z.enum(["local"]).default("local"),
    /** Private directory for uploaded files. Must be outside `public/`. */
    STORAGE_LOCAL_DIR: z.string().default(".data/uploads"),
    MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().max(25).default(10),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (Boolean(env.AUTH_GOOGLE_ID) !== Boolean(env.AUTH_GOOGLE_SECRET)) {
      issue("AUTH_GOOGLE_SECRET", "Set both AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or neither");
    }
    if (env.AI_PROVIDER === "anthropic" && !env.AI_API_KEY) {
      issue("AI_API_KEY", "AI_API_KEY is required when AI_PROVIDER=anthropic");
    }
    if (env.MAIL_TRANSPORT === "resend") {
      if (!env.RESEND_API_KEY)
        issue("RESEND_API_KEY", "RESEND_API_KEY is required when MAIL_TRANSPORT=resend");
      if (!env.MAIL_FROM) issue("MAIL_FROM", "MAIL_FROM is required when MAIL_TRANSPORT=resend");
    }
    if (env.NODE_ENV !== "production") return;

    // Production-only rules: development defaults must not slip into production.
    if (PLACEHOLDER_SECRETS.test(env.AUTH_SECRET) || new Set(env.AUTH_SECRET).size < 10) {
      issue("AUTH_SECRET", "AUTH_SECRET looks like a placeholder; generate a random secret");
    }
    if (env.MAIL_TRANSPORT === "console") {
      issue("MAIL_TRANSPORT", "MAIL_TRANSPORT=console would write reset links to production logs");
    }
    // Reset links, canonical URLs and the QR code are built from it.
    if (!env.NEXT_PUBLIC_APP_URL)
      issue("NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_APP_URL is required in production");
    for (const key of ["NEXT_PUBLIC_APP_URL", "AUTH_URL"] as const) {
      const url = env[key];
      if (url && !url.startsWith("https://") && !isLocalHost(url)) {
        issue(key, `${key} must use https in production`);
      }
    }
    if (
      env.AUTH_URL &&
      env.NEXT_PUBLIC_APP_URL &&
      new URL(env.AUTH_URL).origin !== new URL(env.NEXT_PUBLIC_APP_URL).origin
    ) {
      issue("AUTH_URL", "AUTH_URL and NEXT_PUBLIC_APP_URL must have the same origin");
    }

    // A real public deployment (not a local production build such as the E2E server).
    const isPublicDeployment = Boolean(
      env.NEXT_PUBLIC_APP_URL && !isLocalHost(env.NEXT_PUBLIC_APP_URL),
    );
    if (
      isPublicDeployment &&
      env.STORAGE_DRIVER === "local" &&
      !path.isAbsolute(env.STORAGE_LOCAL_DIR)
    ) {
      issue(
        "STORAGE_LOCAL_DIR",
        "Use an absolute path on a persistent volume (e.g. /data/uploads); a relative path is inside the container and lost on redeploy",
      );
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** `KEY=""` in an env file means "not set", so defaults apply. */
export function withoutEmptyValues(source: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
}

/** Validates the environment; the error lists variable names and rules, never values. */
export function parseServerEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const parsed = serverEnvSchema.safeParse(withoutEmptyValues(source));
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map(
        (issue) => `${issue.path.join(".")}${issue.code === "custom" ? ` (${issue.message})` : ""}`,
      )
      .join(", ");
    throw new Error(`Invalid server environment variables: ${fields}`);
  }
  return parsed.data;
}
