import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 10 production configuration: platform client-IP header, production
 * environment rules, Resend email transport, readiness probe and deploy config.
 */

const db = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: async () => {
      if (db.fail) throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret");
      return [{ "?column?": 1 }];
    },
  },
}));

import { GET as ready } from "@/app/api/health/ready/route";
import { parseServerEnv } from "@/lib/env-schema";
import { isMailAvailable, passwordResetEmail, sendPasswordResetEmail } from "@/lib/mail";
import { clientIpFromHeaders } from "@/lib/security/client-ip";

const headers = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe("client IP on Railway (X-Real-IP)", () => {
  const railway = { header: "x-real-ip" as const, trustedHops: 1 };

  it("uses the platform-set X-Real-IP and ignores a forged X-Forwarded-For", () => {
    expect(
      clientIpFromHeaders(
        headers({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "6.6.6.6" }),
        railway,
      ),
    ).toBe("198.51.100.7");
  });

  it("rejects missing, malformed or appended values", () => {
    expect(clientIpFromHeaders(headers({}), railway)).toBe("unknown");
    expect(clientIpFromHeaders(headers({ "x-real-ip": "6.6.6.6, 198.51.100.7" }), railway)).toBe(
      "unknown",
    );
    expect(clientIpFromHeaders(headers({ "x-real-ip": "<script>" }), railway)).toBe("unknown");
  });

  it("keeps the proxy-hop model as the default", () => {
    expect(
      clientIpFromHeaders(headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.7" }), {
        header: "x-forwarded-for",
        trustedHops: 1,
      }),
    ).toBe("198.51.100.7");
  });
});

describe("production environment (Railway)", () => {
  const railway = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://app:pw@postgres.railway.internal:5432/railway",
    AUTH_SECRET: "Zk3q9V-xY2mPq7rT1wLs8NbC4dHjE6uA0oIfG5kR",
    NEXT_PUBLIC_APP_URL: "https://skillforge-production.up.railway.app",
    AUTH_URL: "https://skillforge-production.up.railway.app",
    CLIENT_IP_HEADER: "x-real-ip",
    AI_PROVIDER: "anthropic",
    AI_API_KEY: "sk-ant-placeholder-for-tests",
    MAIL_TRANSPORT: "resend",
    RESEND_API_KEY: "re_placeholder_for_tests",
    MAIL_FROM: "SkillForge AI <no-reply@example.com>",
    STORAGE_LOCAL_DIR: "/data/uploads",
  } as unknown as NodeJS.ProcessEnv;

  it("accepts the documented Railway configuration", () => {
    const env = parseServerEnv(railway);
    expect(env.CLIENT_IP_HEADER).toBe("x-real-ip");
    expect(env.MAIL_TRANSPORT).toBe("resend");
  });

  it.each([
    [{ NEXT_PUBLIC_APP_URL: "" }, "NEXT_PUBLIC_APP_URL"],
    [{ AUTH_URL: "https://other.example" }, "AUTH_URL"],
    [{ STORAGE_LOCAL_DIR: ".data/uploads" }, "STORAGE_LOCAL_DIR"],
    [{ RESEND_API_KEY: "" }, "RESEND_API_KEY"],
    [{ MAIL_FROM: "" }, "MAIL_FROM"],
    [{ MAIL_FROM: "not an address" }, "MAIL_FROM"],
    [{ CLIENT_IP_HEADER: "x-client-ip" }, "CLIENT_IP_HEADER"],
  ])("rejects %o", (override, field) => {
    expect(() => parseServerEnv({ ...railway, ...override } as NodeJS.ProcessEnv)).toThrow(field);
  });

  it("still allows a local production build (E2E) with relative storage and http localhost", () => {
    expect(() =>
      parseServerEnv({
        ...railway,
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        AUTH_URL: undefined,
        STORAGE_LOCAL_DIR: ".data/uploads",
        AI_PROVIDER: "mock",
        MAIL_TRANSPORT: undefined,
      } as unknown as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("the production template contains placeholders only", () => {
    const template = readFileSync(path.resolve(".env.production.example"), "utf8");
    for (const line of template.split("\n")) {
      const m = /^([A-Z_]+)="(.*)"$/.exec(line.trim());
      if (!m || !/(SECRET|KEY|PASSWORD)/.test(m[1]!)) continue;
      expect(m[2] === "" || /^<.+>$/.test(m[2]!), `${m[1]} must be empty or a <placeholder>`).toBe(
        true,
      );
    }
  });
});

describe("Resend email transport", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "SkillForge AI <no-reply@example.com>");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is available in production only when fully configured", () => {
    expect(isMailAvailable()).toBe(true);
    vi.stubEnv("RESEND_API_KEY", "");
    expect(isMailAvailable()).toBe(false);
  });

  it("sends one authenticated request with text and escaped HTML", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    const url = "https://app.example/reset-password?token=abc_DEF-123";
    expect(await sendPasswordResetEmail("user@example.com", url)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: "SkillForge AI <no-reply@example.com>",
      to: ["user@example.com"],
    });
    expect(body.text).toContain(url);
    expect(body.html).toContain('href="https://app.example/reset-password?token=abc_DEF-123"');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("fails safely without logging the recipient, link or key", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response("{}", { status: 422 }));
    expect(
      await sendPasswordResetEmail(
        "user@example.com",
        "https://app.example/reset-password?token=SECRET",
      ),
    ).toBe(false);
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(
      await sendPasswordResetEmail(
        "user@example.com",
        "https://app.example/reset-password?token=SECRET",
      ),
    ).toBe(false);
    const logged = errors.mock.calls.flat().join(" ");
    expect(logged).toMatch(/HTTP 422/);
    expect(logged).not.toMatch(/user@example\.com|SECRET|re_test_key/);
  });

  it("escapes HTML in the message", () => {
    expect(passwordResetEmail('https://x.example/?a="><script>').html).not.toContain("<script>");
  });
});

describe("readiness probe", () => {
  afterEach(() => {
    db.fail = false;
    vi.restoreAllMocks();
  });

  it("reports ok when the database answers", async () => {
    const response = await ready();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 without leaking error details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.fail = true;
    const response = await ready();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toBe('{"status":"unavailable"}');
  });
});

describe("Railway deploy configuration", () => {
  const config = JSON.parse(readFileSync(path.resolve("railway.json"), "utf8"));

  it("health-checks readiness and never runs migrations automatically", () => {
    expect(config.deploy.healthcheckPath).toBe("/api/health/ready");
    expect(config.deploy.preDeployCommand).toBeUndefined();
    expect(config.deploy.numReplicas ?? 1).toBe(1);
  });
});
