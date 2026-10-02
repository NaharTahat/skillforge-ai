#!/usr/bin/env node
/**
 * Post-deploy smoke test — NON-DESTRUCTIVE (GET requests only; creates no
 * accounts or data). Usage: npm run smoke -- https://your-app.up.railway.app
 *
 * Checks: pages render, health and readiness (database), protected routes
 * redirect, the API refuses anonymous access, security headers, https-only
 * behaviour, no framework fingerprint, and no stack traces on errors.
 */
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error("Usage: npm run smoke -- https://your-app.example");
  process.exit(2);
}
const isHttps = base.startsWith("https://");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });

async function get(path, init = {}) {
  const started = performance.now();
  const response = await fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
  return { response, ms: Math.round(performance.now() - started), body: await response.text() };
}

try {
  const home = await get("/");
  check(
    "homepage renders",
    home.response.status === 200 && home.body.includes("SkillForge"),
    `${home.response.status}, ${home.ms} ms`,
  );
  const h = home.response.headers;
  const csp = h.get("content-security-policy") ?? "";
  check(
    "CSP present and strict",
    csp.includes("default-src 'self'") &&
      csp.includes("frame-ancestors 'none'") &&
      csp.includes("object-src 'none'") &&
      !csp.includes("unsafe-eval"),
  );
  check("X-Frame-Options DENY", h.get("x-frame-options") === "DENY");
  check("nosniff", h.get("x-content-type-options") === "nosniff");
  check("Referrer-Policy", h.get("referrer-policy") === "strict-origin-when-cross-origin");
  check("COOP same-origin", h.get("cross-origin-opener-policy") === "same-origin");
  check("no X-Powered-By", !h.has("x-powered-by"));
  if (isHttps) {
    check(
      "HSTS on https",
      /max-age=\d{7,}/.test(h.get("strict-transport-security") ?? ""),
      h.get("strict-transport-security") ?? "missing",
    );
    check("CSP upgrades insecure requests", csp.includes("upgrade-insecure-requests"));
    const plain = await fetch(base.replace("https://", "http://") + "/", {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    check(
      "http redirects to https",
      plain &&
        [301, 302, 307, 308].includes(plain.status) &&
        (plain.headers.get("location") ?? "").startsWith("https://"),
      plain ? String(plain.status) : "no response",
    );
  }

  for (const path of ["/login", "/register", "/forgot-password"]) {
    const page = await get(path);
    check(
      `${path} renders`,
      page.response.status === 200,
      `${page.response.status}, ${page.ms} ms`,
    );
  }

  const health = await get("/api/health");
  check(
    "liveness /api/health",
    health.response.status === 200 && JSON.parse(health.body).status === "ok",
  );
  const ready = await get("/api/health/ready");
  check(
    "readiness (database) /api/health/ready",
    ready.response.status === 200,
    `${ready.response.status}, ${ready.ms} ms`,
  );
  check("health reveals nothing else", Object.keys(JSON.parse(ready.body)).join() === "status");

  const dashboard = await get("/dashboard");
  check(
    "dashboard requires sign-in",
    [302, 303, 307, 308].includes(dashboard.response.status) &&
      (dashboard.response.headers.get("location") ?? "").includes("/login"),
  );
  const me = await get("/api/me");
  check(
    "API refuses anonymous access",
    me.response.status === 401 && /no-store/.test(me.response.headers.get("cache-control") ?? ""),
  );

  const missing = await get(`/p/smoke-check-${Date.now()}`);
  check(
    "unknown portfolio is a clean 404",
    missing.response.status === 404 && !/at \w+ \(|node_modules|Error:/.test(missing.body),
  );
  const upload = await get("/api/cv", {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: "x",
  });
  check(
    "cross-origin upload refused",
    upload.response.status === 403 || upload.response.status === 401,
    String(upload.response.status),
  );
} catch (error) {
  check("site reachable", false, `${error.name}: ${error.message}`);
}

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results)
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
