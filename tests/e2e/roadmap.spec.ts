import { expect, test, type Page } from "@playwright/test";
import { makeUser, register, uploadAndAnalyze } from "./helpers";

// Streamed content is briefly duplicated (hidden) while React swaps it in,
// so assertions filter to visible elements.

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
].join("\n");

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });
const tasks = (page: Page) => page.getByTestId("roadmap-task").filter({ visible: true });

/** Registers a user, analyzes a CV and creates one completed job match. */
async function userWithJobMatch(page: Page, name: string, jobTitle = "ML Engineer") {
  await register(page, makeUser(name));
  await uploadAndAnalyze(page, "sample-cv.pdf");
  await page.goto("/dashboard/job-match");
  await page.getByText("sample-cv.pdf").filter({ visible: true }).click();
  await page.getByLabel("Job title (optional)").fill(jobTitle);
  await page.getByLabel("Job description").fill(JOB_DESCRIPTION);
  await page.getByRole("button", { name: "Analyze match" }).click();
  await expect(page.getByRole("heading", { name: "Profile-to-job match" })).toBeVisible({
    timeout: 30_000,
  });
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function setCareerGoal(page: Page, goal: string) {
  await page.goto("/dashboard/profile");
  await page.getByLabel("Career goal").click();
  await page.getByRole("option", { name: goal }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved").first()).toBeVisible();
}

async function generateFromJobMatch(page: Page) {
  await page.goto("/dashboard/roadmap");
  await page.getByRole("button", { name: "Generate job roadmap" }).click();
  await waitForRoadmap(page);
}

async function waitForRoadmap(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/roadmap\/[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Learning phases" })).toBeVisible({
    timeout: 30_000,
  });
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

test.describe("Career Roadmap", () => {
  test("requires authentication", async ({ page }) => {
    await page.goto("/dashboard/roadmap");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%2Froadmap$/);
    await page.goto("/dashboard/roadmap/some-roadmap-id");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("loads and asks users without a CV to analyze one first", async ({ page }) => {
    await register(page, makeUser("NoCv"));
    await page.goto("/dashboard/roadmap");
    await expect(page.getByRole("heading", { name: "Career Roadmap", level: 1 })).toBeVisible();
    await expect(visible(page, "Turn your skill gaps into an actionable plan.")).toBeVisible();
    await expect(
      visible(page, "Analyze your CV first to create a personalized roadmap."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to CV Analyzer" })).toHaveAttribute(
      "href",
      "/dashboard/cv",
    );
    await expect(visible(page, "No roadmaps yet")).toBeVisible();
  });

  test("creates a roadmap from a Job Match and renders every section", async ({ page }) => {
    await userWithJobMatch(page, "FromJob");
    await page.goto("/dashboard/roadmap");
    // Without a profile goal, the career-goal form asks for one.
    await expect(visible(page, "Set a career goal in your Profile first.")).toBeVisible();
    await page.getByRole("button", { name: "Generate job roadmap" }).click();

    // Mock generation completes.
    await waitForRoadmap(page);
    await expect(
      page.getByRole("heading", { name: "Roadmap to ML Engineer", level: 1 }),
    ).toBeVisible();
    await expect(visible(page, "Job roadmap · from Job Match")).toBeVisible();
    await expect(visible(page, /deterministic mock provider/)).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    // Current profile and skill gaps.
    await expect(page.getByRole("heading", { name: "Your current profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skill gaps" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Not demonstrated in your CV \(\d+\)$/ }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/you lack/i);

    // Phases, tasks and milestones.
    await expect(page.getByTestId("roadmap-phase").filter({ visible: true })).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "Phase 1: Foundations" })).toBeVisible();
    expect(await tasks(page).count()).toBeGreaterThanOrEqual(4);
    await expect(tasks(page).first()).toContainText(/priority/);
    await expect(tasks(page).first()).toContainText("How to verify");
    await expect(page.getByTestId("roadmap-milestone").filter({ visible: true })).toHaveCount(3);
    await expect(visible(page, "Shipped a portfolio project")).toBeVisible();
  });

  test("creates a career-goal roadmap from the profile goal", async ({ page }) => {
    await register(page, makeUser("Goal"));
    await uploadAndAnalyze(page, "sample-cv.pdf");
    await setCareerGoal(page, "Data Scientist");

    await page.goto("/dashboard/roadmap");
    await expect(visible(page, "Create a Job Match first.")).toBeVisible();
    await expect(visible(page, "Career goal (from Profile)")).toBeVisible();
    await page.getByText("12 weeks").filter({ visible: true }).click();
    await page.getByRole("button", { name: "Generate career-goal roadmap" }).click();

    await waitForRoadmap(page);
    await expect(
      page.getByRole("heading", { name: "Roadmap to Data Scientist", level: 1 }),
    ).toBeVisible();
    await expect(visible(page, /^Career-goal roadmap · Data Scientist/)).toBeVisible();
    await expect(visible(page, "(target 12 weeks)")).toBeVisible();
  });

  test("task status changes persist, unlock dependents and update progress", async ({ page }) => {
    await userWithJobMatch(page, "Tasks");
    await generateFromJobMatch(page);
    const roadmapUrl = page.url();

    const first = tasks(page).first();
    await expect(first).toHaveAttribute("data-status", "AVAILABLE");
    await first.getByRole("button", { name: /as in progress$/ }).click();
    await expect(first).toHaveAttribute("data-status", "IN_PROGRESS");
    await expect(first).toContainText("Status: In progress");

    // A locked task explains why and offers no actions.
    const lockedTask = page
      .locator('[data-testid="roadmap-task"][data-status="LOCKED"]')
      .filter({ visible: true })
      .first();
    await expect(lockedTask).toContainText("Locked — complete the prerequisites first.");
    await expect(lockedTask.getByRole("button")).toHaveCount(0);

    // Complete tasks in order until the portfolio project unlocks.
    const project = tasks(page).filter({
      has: page.getByRole("heading", { name: /^Build a portfolio project/ }),
    });
    await expect(project).toHaveAttribute("data-status", "LOCKED");
    const total = await tasks(page).count();
    let completed = 0;
    for (let i = 0; i < total; i++) {
      if ((await project.getAttribute("data-status")) !== "LOCKED") break;
      const task = tasks(page).nth(i);
      if ((await task.getAttribute("data-status")) === "LOCKED") continue;
      await task.getByRole("button", { name: /as completed$/ }).click();
      await expect(task).toHaveAttribute("data-status", "COMPLETED");
      completed++;
    }
    await expect(project).toHaveAttribute("data-status", "AVAILABLE");

    const percent = Math.round((completed / total) * 1000) / 10;
    const label = `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% complete`;
    await expect(page.getByTestId("progress-percent").filter({ visible: true })).toHaveText(label);
    await expect(visible(page, `${completed} of ${total} tasks completed`)).toBeVisible();

    // Persisted: survives a reload.
    await page.goto(roadmapUrl);
    await expect(page.getByTestId("progress-percent").filter({ visible: true })).toHaveText(label);

    // Reopening a completed task.
    await tasks(page)
      .first()
      .getByRole("button", { name: /^Reopen/ })
      .click();
    await expect(tasks(page).first()).toHaveAttribute("data-status", "AVAILABLE");
  });

  test("keeps history, re-generates into a new roadmap, and deletes", async ({ page }) => {
    await userWithJobMatch(page, "History");
    await generateFromJobMatch(page);
    const firstUrl = page.url();

    // History persists across a reload.
    await page.goto("/dashboard/roadmap");
    await page.reload();
    const history = page.getByRole("region", { name: "Your roadmaps" }).getByRole("listitem");
    await expect(history.filter({ visible: true })).toHaveCount(1);
    await expect(history.filter({ visible: true }).first()).toContainText("Roadmap to ML Engineer");

    // Re-generation creates a new roadmap and keeps the old one.
    await page.goto(firstUrl);
    await page.getByRole("button", { name: /^Re-generate/ }).click();
    await expect(page).not.toHaveURL(firstUrl, { timeout: 30_000 });
    await waitForRoadmap(page);
    await expect(visible(page, /Re-generated from an earlier roadmap/)).toBeVisible();
    const secondUrl = page.url();
    await page.goto("/dashboard/roadmap");
    await expect(history.filter({ visible: true })).toHaveCount(2);
    await page.goto(firstUrl);
    await expect(page.getByRole("heading", { name: "Learning phases" })).toBeVisible();

    // Delete.
    await page.goto(secondUrl);
    await page.getByRole("button", { name: /^Delete Roadmap to/ }).click();
    await page.getByRole("button", { name: "Delete roadmap" }).click();
    await expect(page).toHaveURL(/\/dashboard\/roadmap$/);
    await expect(history.filter({ visible: true })).toHaveCount(1);
    await page.goto(secondUrl);
    await expect(page.getByText("Roadmap not found")).toBeVisible();
  });

  test("prevents duplicate concurrent generation", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await userWithJobMatch(page, "Dup");

    const second = await context.newPage();
    await Promise.all([page.goto("/dashboard/roadmap"), second.goto("/dashboard/roadmap")]);
    await Promise.all([
      page.getByRole("button", { name: "Generate job roadmap" }).click(),
      second.getByRole("button", { name: "Generate job roadmap" }).click(),
    ]);
    await waitForRoadmap(page);
    await waitForRoadmap(second);
    expect(new URL(page.url()).pathname).toBe(new URL(second.url()).pathname);

    await page.goto("/dashboard/roadmap");
    const history = page.getByRole("region", { name: "Your roadmaps" }).getByRole("listitem");
    await expect(history.filter({ visible: true })).toHaveCount(1);
    await context.close();
  });
});

test.describe("Career Roadmap access control", () => {
  test("users cannot open, change or build from another user's data", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const other = await otherContext.newPage();

    const ownerJobId = await userWithJobMatch(owner, "Owner", "Private Role");
    await generateFromJobMatch(owner);
    const ownerRoadmap = owner.url();
    const ownerTaskId = await tasks(owner).first().getAttribute("data-task-id");
    expect(ownerTaskId).toBeTruthy();

    const otherJobId = await userWithJobMatch(other, "Intruder");

    // Opening the owner's roadmap looks exactly like a missing one.
    await other.goto(ownerRoadmap);
    await expect(other.getByText("Roadmap not found")).toBeVisible();
    await expect(other.locator("body")).not.toContainText("Private Role");

    // Creating a roadmap from the owner's job match (request tampered in transit).
    await other.route("**/dashboard/roadmap", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const body = request.postData() ?? "";
        expect(body).toContain(otherJobId);
        await route.continue({ postData: body.replaceAll(otherJobId, ownerJobId) });
      } else {
        await route.continue();
      }
    });
    await other.goto("/dashboard/roadmap");
    await other.getByRole("button", { name: "Generate job roadmap" }).click();
    await expect(visible(other, /That job match isn't available/)).toBeVisible();
    await expect(other).toHaveURL(/\/dashboard\/roadmap$/);
    await other.unroute("**/dashboard/roadmap");

    // Changing the owner's task (task id swapped in transit).
    await generateFromJobMatch(other);
    const ownTaskId = (await tasks(other).first().getAttribute("data-task-id"))!;
    await other.route("**/dashboard/roadmap/*", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const body = request.postData() ?? "";
        await route.continue({ postData: body.replaceAll(ownTaskId, ownerTaskId!) });
      } else {
        await route.continue();
      }
    });
    await tasks(other)
      .first()
      .getByRole("button", { name: /as completed$/ })
      .click();
    await expect(
      visible(other, /This task doesn't exist or you don't have access to it/),
    ).toBeVisible();

    await owner.reload();
    await expect(tasks(owner).first()).toHaveAttribute("data-status", "AVAILABLE");
    await expect(owner.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    await ownerContext.close();
    await otherContext.close();
  });

  test("rejects an invalid roadmap source", async ({ page }) => {
    await userWithJobMatch(page, "BadSource");
    await page.route("**/dashboard/roadmap", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const body = request.postData() ?? "";
        expect(body).toContain('"JOB_MATCH"');
        await route.continue({ postData: body.replace('"JOB_MATCH"', '"ADMIN_IMPORT"') });
      } else {
        await route.continue();
      }
    });
    await page.goto("/dashboard/roadmap");
    await page.getByRole("button", { name: "Generate job roadmap" }).click();
    await expect(visible(page, "Choose a valid source for your roadmap.")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/roadmap$/);
    await expect(visible(page, "No roadmaps yet")).toBeVisible();
  });
});

test.describe("Career Roadmap layout", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`works on mobile in the ${theme} theme`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await context.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
      const page = await context.newPage();

      await userWithJobMatch(
        page,
        `Mobile${theme}`,
        "Senior Machine Learning Engineer, Platform & Infrastructure Team",
      );
      await page.goto("/dashboard/roadmap");
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await page.getByRole("button", { name: "Generate job roadmap" }).click();
      await waitForRoadmap(page);
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();

      // Status buttons are reachable by keyboard.
      const button = tasks(page)
        .first()
        .getByRole("button", { name: /as in progress$/ });
      await button.focus();
      await page.keyboard.press("Enter");
      await expect(tasks(page).first()).toHaveAttribute("data-status", "IN_PROGRESS");

      await page.goto("/dashboard/roadmap");
      await expect(page.getByRole("heading", { name: "Your roadmaps" })).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await context.close();
    });
  }
});
