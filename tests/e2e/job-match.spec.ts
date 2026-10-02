import { expect, test, type Page } from "@playwright/test";
import { makeUser, register, uploadAndAnalyze } from "./helpers";

// Streamed content is briefly duplicated (hidden) while React swaps it in,
// so text assertions filter to visible elements.

const JOB_DESCRIPTION = [
  "We are hiring a Machine Learning Engineer to build production ML services.",
  "Requirements:",
  "- 3+ years of Python experience",
  "- Strong SQL skills",
  "- Experience with Kubernetes in production",
  "- Bachelor's degree in Computer Science or a related field",
  "Nice to have:",
  "- Docker",
  "- AWS",
  "Responsibilities:",
  "- Deploy and monitor machine learning models",
].join("\n");

/** Registers a user with one analyzed CV and opens the Job Match page. */
async function userWithAnalyzedCv(page: Page, name: string) {
  await register(page, makeUser(name));
  const cvId = await uploadAndAnalyze(page, "sample-cv.pdf");
  await page.goto("/dashboard/job-match");
  await expect(page.locator('input[type="radio"]')).toHaveCount(1);
  return cvId;
}

async function fillAndSubmit(page: Page, title = "ML Engineer") {
  await page.getByText("sample-cv.pdf").filter({ visible: true }).click();
  await page.getByLabel("Job title (optional)").fill(title);
  await page.getByLabel("Company (optional)").fill("Northwind Labs");
  await page.getByLabel("Job description").fill(JOB_DESCRIPTION);
  await page.getByRole("button", { name: "Analyze match" }).click();
}

async function waitForReport(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/job-match\/[a-z0-9]+\?analysis=/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Profile-to-job match" })).toBeVisible({
    timeout: 30_000,
  });
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

test.describe("Job Match", () => {
  test("requires authentication", async ({ page }) => {
    await page.goto("/dashboard/job-match");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%2Fjob-match$/);
    await page.goto("/dashboard/job-match/some-match-id");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    // The old placeholder route redirects to the new one.
    await page.goto("/dashboard/jobs");
    await expect(page).toHaveURL(/callbackUrl=%2Fdashboard%2Fjob-match/);
  });

  test("asks users without an analyzed CV to analyze one first", async ({ page }) => {
    await register(page, makeUser("NoCv"));
    await page.goto("/dashboard/job-match");
    await expect(
      page.getByText("Analyze your CV first to unlock Job Match.").filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to CV Analyzer" })).toHaveAttribute(
      "href",
      "/dashboard/cv",
    );
  });

  test("rejects an invalid job description", async ({ page }) => {
    await userWithAnalyzedCv(page, "Invalid");
    await page.getByLabel("Job description").fill("Python developer wanted.");
    await page.getByRole("button", { name: "Analyze match" }).click();
    await expect(page.getByText(/job description is too short/)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/job-match$/);
  });

  test("selects the user's CV, runs a mock analysis and renders the report", async ({ page }) => {
    await userWithAnalyzedCv(page, "Match");
    await fillAndSubmit(page);
    await waitForReport(page);

    await expect(page.getByRole("heading", { name: "ML Engineer" })).toBeVisible();
    await expect(page.getByText(/Mock analysis\./)).toBeVisible();
    await expect(page.getByText(/(Strong|Good|Partial|Limited) alignment/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Found in your CV/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Not found in your CV/ })).toBeVisible();
    await expect(page.getByText("Kubernetes", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Likely interview topics" })).toBeVisible();
    await expect(page.getByText(/not a probability of being hired/)).toBeAttached();
  });

  test("keeps history, re-analyzes into a new record, and deletes", async ({ page }) => {
    await userWithAnalyzedCv(page, "History");
    await fillAndSubmit(page, "Data Scientist");
    await waitForReport(page);
    const matchUrl = new URL(page.url());
    const firstRun = matchUrl.searchParams.get("analysis");

    // History persists across a reload of the list page.
    await page.goto("/dashboard/job-match");
    await page.reload();
    const item = page.getByRole("listitem").filter({ hasText: "Data Scientist · Northwind Labs" });
    await expect(item.filter({ visible: true })).toBeVisible();

    // Re-analysis creates a new record and keeps the old one.
    await page.goto(matchUrl.pathname);
    await page.getByRole("button", { name: /^Re-analyze/ }).click();
    await expect(page).not.toHaveURL(new RegExp(`analysis=${firstRun}`));
    await expect(page.getByRole("heading", { name: "Profile-to-job match" })).toBeVisible({
      timeout: 30_000,
    });
    const runs = page.getByRole("complementary", { name: "Match history" }).getByRole("listitem");
    await expect(runs).toHaveCount(2);
    await page.goto(`${matchUrl.pathname}?analysis=${firstRun}`);
    await expect(page.getByRole("heading", { name: "Profile-to-job match" })).toBeVisible();

    // Delete.
    await page.getByRole("button", { name: /^Delete Data Scientist/ }).click();
    await page.getByRole("button", { name: "Delete match" }).click();
    await expect(page).toHaveURL(/\/dashboard\/job-match$/);
    await expect(page.getByText("No job matches yet").filter({ visible: true })).toBeVisible();
    await page.goto(matchUrl.pathname);
    await expect(page.getByText("Job match not found")).toBeVisible();
  });

  test("handles duplicate re-analysis requests without creating duplicates", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await userWithAnalyzedCv(page, "Dup");
    await fillAndSubmit(page);
    await waitForReport(page);
    const matchPath = new URL(page.url()).pathname;

    // Two tabs press Re-analyze at the same moment.
    const second = await context.newPage();
    await Promise.all([page.goto(matchPath), second.goto(matchPath)]);
    // Wait until both buttons are actionable so the clicks really are simultaneous; on a
    // slow machine one tab can otherwise click after the first re-run already finished.
    const buttons = [page, second].map((p) =>
      p.getByRole("button", { name: /^Re-analyze/ }).filter({ visible: true }),
    );
    for (const b of buttons) await expect(b).toBeEnabled();
    await Promise.all(buttons.map((b) => b.click()));
    await expect(page.getByRole("heading", { name: "Profile-to-job match" })).toBeVisible({
      timeout: 30_000,
    });
    await page.goto(matchPath);
    const runs = page.getByRole("complementary", { name: "Match history" }).getByRole("listitem");
    await expect(runs).toHaveCount(2); // the original + exactly one re-run
    await context.close();
  });
});

test.describe("Job Match access control", () => {
  test("users cannot open another user's match or use another user's CV", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const other = await otherContext.newPage();

    const ownerCvId = await userWithAnalyzedCv(owner, "Owner");
    await fillAndSubmit(owner, "Private Role");
    await waitForReport(owner);
    const ownerMatch = owner.url();

    const intruderCvId = await userWithAnalyzedCv(other, "Intruder");

    // Opening the owner's match looks exactly like a missing one.
    await other.goto(ownerMatch);
    await expect(other.getByText("Job match not found")).toBeVisible();
    await expect(other.locator("body")).not.toContainText("Private Role");

    // An attacker rewrites the outgoing request to use the owner's CV id.
    // The server must refuse it, whatever the browser sends.
    await other.route("**/dashboard/job-match", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const body = request.postData() ?? "";
        expect(body).toContain(intruderCvId);
        await route.continue({ postData: body.replaceAll(intruderCvId, ownerCvId) });
      } else {
        await route.continue();
      }
    });
    await other.goto("/dashboard/job-match");
    await expect(other.locator('input[type="radio"]')).toHaveCount(1);
    await other.getByLabel("Job description").fill(JOB_DESCRIPTION);
    await other.getByRole("button", { name: "Analyze match" }).click();
    await expect(other.getByText("That CV isn't available. Choose one of your CVs.")).toBeVisible();
    await expect(other).toHaveURL(/\/dashboard\/job-match$/);

    await ownerContext.close();
    await otherContext.close();
  });
});

test.describe("Job Match layout", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`works on mobile in the ${theme} theme`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await context.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
      const page = await context.newPage();

      await userWithAnalyzedCv(page, `Mobile${theme}`);
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      expect(await hasHorizontalOverflow(page)).toBe(false);

      // A long title must truncate, not widen the page (regression: history list overflow).
      await fillAndSubmit(page, "Senior Machine Learning Engineer, Platform & Infrastructure Team");
      await waitForReport(page);
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();

      await page.goto("/dashboard/job-match");
      await expect(page.getByRole("heading", { name: "Match history" })).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await context.close();
    });
  }
});
