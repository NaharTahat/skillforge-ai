import { expect, test, type Page } from "@playwright/test";
import { login, makeUser, register, signOut } from "./helpers";

/**
 * Phase 9 security regression tests: headers, CSP compatibility, session
 * revocation, rate-limit bypass attempts, redirects, CSRF, enumeration and XSS.
 */

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });

test.describe("Security headers", () => {
  test("pages and APIs send hardened headers", async ({ request }) => {
    for (const path of ["/", "/login", "/api/health", "/p/nobody-here-at-all"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      const h = response.headers();
      const csp = h["content-security-policy"] ?? "";
      expect(csp, path).toContain("default-src 'self'");
      expect(csp, path).toContain("object-src 'none'");
      expect(csp, path).toContain("frame-ancestors 'none'");
      expect(csp, path).toContain("base-uri 'self'");
      expect(csp, path).not.toContain("'unsafe-eval'");
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(h["cross-origin-opener-policy"], path).toBe("same-origin");
      expect(h["permissions-policy"], path).toContain("camera=()");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
    expect((await request.get("/api/health")).headers()["cache-control"]).toContain("no-store");
  });

  test("private pages and APIs are never cacheable", async ({ page }) => {
    await register(page, makeUser("SecCache"));
    for (const path of ["/dashboard", "/dashboard/profile", "/dashboard/portfolio"]) {
      const response = await page.goto(path);
      expect(response?.headers()["cache-control"], path).toMatch(/no-store/);
    }
    const me = await page.request.get("/api/me");
    expect(me.headers()["cache-control"]).toMatch(/no-store/);
  });

  test("the app runs without Content-Security-Policy violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(m.text()))
        violations.push(m.text());
    });
    await register(page, makeUser("SecCsp"));
    for (const path of [
      "/dashboard",
      "/dashboard/cv",
      "/dashboard/job-match",
      "/dashboard/roadmap",
      "/dashboard/interview",
      "/dashboard/assessments",
      "/dashboard/portfolio",
      "/dashboard/portfolio/settings",
      "/dashboard/skill-passport",
      "/dashboard/profile",
      "/",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    // Client-side navigation and theme switching (inline styles/scripts) too.
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Portfolio" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/portfolio$/);
    expect(violations).toEqual([]);
  });
});

test.describe("Session security", () => {
  test("signing out revokes the session even if its cookie was copied", async ({
    page,
    browser,
  }) => {
    await register(page, makeUser("SecRevoke"));
    const copied = await page.context().cookies();

    // The copy works while the session is live…
    const before = await browser.newContext();
    await before.addCookies(copied);
    const beforePage = await before.newPage();
    await beforePage.goto("/dashboard/profile");
    await expect(beforePage).toHaveURL(/\/dashboard\/profile$/);
    await before.close();

    await signOut(page);

    // …and is rejected after sign-out.
    const after = await browser.newContext();
    await after.addCookies(copied);
    const afterPage = await after.newPage();
    expect((await afterPage.request.get("/api/me")).status()).toBe(401);
    await afterPage.goto("/dashboard/profile");
    await expect(afterPage).toHaveURL(/\/auth\/session-expired$/);
    await expect(afterPage.locator("body")).not.toContainText("SecRevoke");
    await after.close();
  });

  test("ignores external callback URLs after login (no open redirect)", async ({ page }) => {
    const user = makeUser("SecRedirect");
    await register(page, user);
    for (const evil of ["https://evil.example/phish", "//evil.example", "/\\evil.example"]) {
      await signOut(page);
      await page.goto(`/login?callbackUrl=${encodeURIComponent(evil)}`);
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(user.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/dashboard$/);
    }
  });
});

test.describe("Abuse protection", () => {
  test("login attempts are limited per account even with spoofed X-Forwarded-For", async ({
    page,
  }) => {
    const user = makeUser("SecBrute");
    await register(page, user);
    await signOut(page);
    for (let i = 0; i < 10; i++) {
      // A different forged client address on every attempt.
      await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${i + 1}` });
      await login(page, user.email, `Wrong-Password-${i}`);
      await expect(visible(page, "Invalid email or password.")).toBeVisible();
    }
    await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.77" });
    // Even the correct password is refused while the account is throttled.
    await login(page, user.email, user.password);
    await expect(visible(page, /Too many attempts/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("cross-origin and unauthenticated API calls are rejected", async ({ request, page }) => {
    const anonymous = await request.post("/api/cv", {
      multipart: {
        file: { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      },
    });
    expect([401, 403]).toContain(anonymous.status());

    await register(page, makeUser("SecCsrf"));
    const crossSite = await page.request.post("/api/cv", {
      headers: { origin: "https://evil.example" },
      multipart: {
        file: { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
      },
    });
    expect(crossSite.status()).toBe(403);
    expect(await crossSite.text()).not.toMatch(/stack|at \w+ \(|node_modules/i);
  });
});

test.describe("Account recovery", () => {
  test("password reset gives identical answers for known and unknown emails", async ({ page }) => {
    const user = makeUser("SecForgot");
    await register(page, user);
    await signOut(page);
    const answers: string[] = [];
    for (const email of [user.email, `nobody-${Date.now()}@example.test`]) {
      await page.goto("/forgot-password");
      await page.getByLabel("Email").fill(email);
      await page.locator('button[type="submit"]').click();
      const alert = page
        .getByRole("alert")
        .or(page.locator('[data-slot="alert"]'))
        .filter({ visible: true })
        .first();
      await expect(alert).toBeVisible();
      answers.push((await alert.innerText()).trim());
    }
    expect(answers[0]).toBe(answers[1]);
  });

  test("a forged reset token is rejected", async ({ page }) => {
    await page.goto(`/reset-password?token=${"x".repeat(43)}`);
    await page.getByLabel("New password", { exact: true }).fill("Brand-New-Pass1");
    await page.getByLabel("Confirm new password").fill("Brand-New-Pass1");
    await page.locator('button[type="submit"]').click();
    await expect(visible(page, /invalid or has expired/)).toBeVisible();
  });
});

test.describe("Stored XSS", () => {
  test("user content is rendered as text on the public portfolio", async ({ page }) => {
    let dialogs = 0;
    page.on("dialog", async (d) => {
      dialogs++;
      await d.dismiss();
    });
    await register(page, makeUser("SecXss"));
    const payload = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    await page.goto("/dashboard/portfolio/edit");
    await page.locator('[id="headline"]').filter({ visible: true }).fill(payload);
    await page.getByRole("button", { name: "Save profile" }).filter({ visible: true }).click();
    await expect(visible(page, "Profile saved")).toBeVisible();

    const username = `xss${Date.now().toString(36)}`;
    await page.goto("/dashboard/portfolio/settings");
    await page.locator('[id="username"]').filter({ visible: true }).fill(username);
    await page.locator('[id="isPublic"]').filter({ visible: true }).check();
    await page.getByRole("button", { name: "Save settings" }).filter({ visible: true }).click();
    await expect(visible(page, "Saved. Your portfolio is public.")).toBeVisible();

    await page.goto(`/p/${username}`);
    await expect(visible(page, payload)).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(dialogs).toBe(0);
  });
});
