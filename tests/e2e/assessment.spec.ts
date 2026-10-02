import { expect, test, type Page } from "@playwright/test";
import { dbQuery } from "./db";
import { makeUser, register, uploadAndAnalyze, type TestUser } from "./helpers";

// Streamed content is briefly duplicated (hidden) while React swaps it in,
// so assertions filter to visible elements.

const JOB_DESCRIPTION = [
  "We are hiring a Machine Learning Engineer to build production ML services.",
  "Requirements:",
  "- 3+ years of Python experience",
  "- Strong SQL skills",
  "- Experience with Kubernetes in production",
  "Nice to have:",
  "- Docker",
  "- AWS",
].join("\n");

/** At least 40 words: the mock evaluator rates it a detailed answer. */
const LONG_ANSWER =
  "I check correctness by writing small test cases with known inputs and expected outputs, including edge cases " +
  "such as empty lists and very large values. I run them after every change, compare results against a trusted " +
  "reference, and review the code with a teammate before relying on it in production.";

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });

async function newUserWithCv(page: Page, name: string): Promise<TestUser> {
  const user = makeUser(name);
  await register(page, user);
  await uploadAndAnalyze(page, "sample-cv.pdf");
  return user;
}

async function createJobMatch(page: Page, jobTitle = "ML Engineer") {
  await page.goto("/dashboard/job-match");
  await page.getByText("sample-cv.pdf").filter({ visible: true }).click();
  await page.getByLabel("Job title (optional)").fill(jobTitle);
  await page.getByLabel("Job description").fill(JOB_DESCRIPTION);
  await page.getByRole("button", { name: "Analyze match" }).click();
  await expect(page.getByRole("heading", { name: "Profile-to-job match" })).toBeVisible({
    timeout: 30_000,
  });
}

async function setCareerGoal(page: Page, goal: string) {
  await page.goto("/dashboard/profile");
  await page.getByLabel("Career goal").click();
  await page.getByRole("option", { name: goal }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved").first()).toBeVisible();
}

/**
 * The create form's choices are visually hidden radio inputs inside styled labels, so they are
 * checked through their label (force) and then verified.
 */
async function choose(page: Page, name: string | RegExp) {
  const radio = page.getByRole(
    "radio",
    typeof name === "string" ? { name, exact: true } : { name },
  );
  await radio.check({ force: true });
  await expect(radio).toBeChecked();
}

/** From the create form: choose a source card, optional skill, count and limit, then generate. */
async function generate(
  page: Page,
  options: { source?: string; skill?: string; count?: number; limit?: string } = {},
) {
  if (options.source) await choose(page, new RegExp(`^${options.source}`));
  if (options.skill) await page.getByLabel("2. Skill").selectOption(options.skill);
  await choose(page, `${options.count ?? 5} questions`);
  if (options.limit) await choose(page, options.limit);
  await page.getByRole("button", { name: "Generate assessment" }).click();
  await expect(page).toHaveURL(/\/dashboard\/assessments\/[a-z0-9]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Ready to start" })).toBeVisible({
    timeout: 30_000,
  });
}

async function start(page: Page, total = 5) {
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(visible(page, `Question 1 of ${total}`)).toBeVisible();
}

async function save(page: Page) {
  const before = await page
    .getByTestId("assessment-progress")
    .filter({ visible: true })
    .textContent();
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByTestId("assessment-progress").filter({ visible: true })).not.toHaveText(
    before!,
  );
}

async function submitAll(page: Page) {
  await page.getByRole("button", { name: "Submit assessment" }).click();
  const anyway = page.getByRole("button", { name: "Submit anyway" });
  if (await anyway.isVisible()) await anyway.click();
  await expect(page).toHaveURL(/\/results$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible();
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

async function tamper(page: Page, urlGlob: string, from: string, to: string) {
  await page.route(urlGlob, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await route.continue({ postData: (request.postData() ?? "").replaceAll(from, to) });
    } else {
      await route.continue();
    }
  });
}

test.describe("AI Assessments", () => {
  test("requires authentication on every route", async ({ page }) => {
    for (const path of [
      "/dashboard/assessments",
      "/dashboard/assessments/history",
      "/dashboard/assessments/x1",
      "/dashboard/assessments/x1/results",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    }
  });

  test("shows the right empty states", async ({ page }) => {
    const user = makeUser("AsEmpty");
    await register(page, user);
    await page.goto("/dashboard/assessments");
    await expect(page.getByRole("heading", { name: "Assessments", level: 1 })).toBeVisible();
    await expect(visible(page, "Upload your CV first.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to CV Analyzer" })).toHaveAttribute(
      "href",
      "/dashboard/cv",
    );
    await expect(visible(page, "No assessments yet")).toBeVisible();

    // CV exists, but its analysis is gone.
    await uploadAndAnalyze(page, "sample-cv.pdf");
    await dbQuery(
      `DELETE FROM "CvAnalysis" WHERE "cvId" IN (SELECT c.id FROM "CV" c JOIN "User" u ON u.id = c."userId" WHERE u.email = $1)`,
      [user.email],
    );
    await page.goto("/dashboard/assessments");
    await expect(visible(page, "Analyze your CV first.")).toBeVisible();

    // A second user with an analyzed CV but no Job Match and no Career Goal.
    const other = await page.context().browser()!.newContext();
    const p2 = await other.newPage();
    await newUserWithCv(p2, "AsSources");
    await p2.goto("/dashboard/assessments");
    await choose(p2, /^Job Match/);
    await expect(visible(p2, "Create a Job Match first.")).toBeVisible();
    await choose(p2, /^Career Goal/);
    await expect(visible(p2, "Create a Career Goal first.")).toBeVisible();
    await expect(p2.getByRole("button", { name: "Generate assessment" })).toHaveCount(0);
    await other.close();
  });

  test("runs a Skill assessment: questions, navigation, locked answers, submission and results", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await newUserWithCv(page, "AsSkill");
    await page.goto("/dashboard/assessments");
    // Configuration defaults.
    await expect(page.getByRole("radio", { name: "Mixed", exact: true }).first()).toBeChecked();
    await expect(page.getByRole("radio", { name: "Adaptive", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "10 questions", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "30 minutes", exact: true })).toBeChecked();
    await generate(page, { source: "Skill", skill: "Python" });
    await expect(page.getByRole("heading", { name: "Python assessment", level: 1 })).toBeVisible();
    await start(page);
    await expect(page.getByTestId("assessment-timer").filter({ visible: true })).toBeVisible();

    // Q1: multiple choice, with its source and reason.
    await expect(page.getByTestId("question-prompt").filter({ visible: true })).toHaveText(
      "Which Python data structure provides average O(1) lookup by key?",
    );
    await expect(page.getByTestId("question-source").filter({ visible: true })).toContainText(
      "Python",
    );
    await page.getByRole("radio", { name: "Dictionary" }).check();
    await save(page);
    await expect(visible(page, "Question 2 of 5")).toBeVisible();
    await expect(page.getByTestId("assessment-progress").filter({ visible: true })).toHaveText(
      "1 / 5 answered",
    );

    // Navigate back: the saved answer is locked.
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(visible(page, "Answer saved — locked")).toBeVisible();
    await expect(page.getByTestId("saved-answer").filter({ visible: true })).toHaveText(
      "Dictionary",
    );
    await expect(page.getByRole("radio", { name: "List" })).toHaveCount(0);
    await page.getByRole("button", { name: "Next" }).click();

    // Q2: short answer. Q3: true/false. Q4: left unanswered. Q5: a wrong choice.
    await page.getByLabel("Your answer").fill(LONG_ANSWER);
    await save(page);
    await page.getByRole("radio", { name: "True" }).check();
    await save(page);
    await expect(visible(page, "Question 4 of 5")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("radio", { name: "4", exact: true }).check();
    await save(page);
    await expect(page.getByTestId("assessment-progress").filter({ visible: true })).toHaveText(
      "4 / 5 answered",
    );

    await page.getByRole("button", { name: "Submit assessment" }).click();
    await expect(visible(page, "1 unanswered question will score 0.")).toBeVisible();
    await page.getByRole("button", { name: "Submit anyway" }).click();
    await expect(page).toHaveURL(/\/results$/, { timeout: 30_000 });

    // Results: deterministic scores, skill breakdown, insights, answer review.
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible();
    await expect(page.getByTestId("overall-percentage").filter({ visible: true })).toHaveText(
      /^\d+%$/,
    );
    await expect(page.getByTestId("raw-score").filter({ visible: true })).toContainText(
      "/ 5 points",
    );
    await expect(page.getByTestId("skill-breakdown").filter({ visible: true })).toContainText(
      "Python",
    );
    for (const h of [
      "Category scores",
      "Skill breakdown",
      "Strengths",
      "Improvement areas",
      "Recommendations",
      "Answer review",
    ]) {
      await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("recommendations").filter({ visible: true })).toContainText(
      "Python",
    );
    const q5 = page.getByTestId("answer-review-item").filter({ visible: true }).nth(4);
    await q5.locator("summary").click();
    await expect(q5).toContainText("Correct answer");
    await expect(q5).toContainText("3");
    await expect(visible(page, /deterministic mock provider/)).toBeVisible();

    // The dashboard shows the real result.
    await page.goto("/dashboard");
    const card = page.getByTestId("assessments-summary").filter({ visible: true });
    await expect(card).toContainText("Latest score");
    await expect(card).toContainText("Assessments completed");
    await expect(card).toContainText("Python —");
  });

  test("keeps history, practices again into a new assessment, and deletes", async ({ page }) => {
    await newUserWithCv(page, "AsHistory");
    await page.goto("/dashboard/assessments");
    await generate(page, { source: "Skill", skill: "SQL" });
    const firstUrl = page.url();
    await start(page);
    await submitAll(page);

    await page.goto("/dashboard/assessments/history");
    const items = page.getByTestId("assessment-history-item").filter({ visible: true });
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("SQL assessment");
    await expect(items.first()).toContainText("Completed");
    await expect(items.first()).toContainText("%");

    await items
      .first()
      .getByRole("button", { name: /^Practice again/ })
      .click();
    await expect(page).not.toHaveURL(firstUrl);
    await expect(page.getByRole("heading", { name: "Ready to start" })).toBeVisible({
      timeout: 30_000,
    });
    const secondUrl = page.url();
    await page.goto("/dashboard/assessments/history");
    await expect(items).toHaveCount(2);
    await page.goto(`${firstUrl}/results`);
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible();

    await page.goto(secondUrl);
    await page.getByRole("button", { name: /^Delete SQL assessment/ }).click();
    await page.getByRole("button", { name: "Delete assessment" }).click();
    await expect(page).toHaveURL(/\/dashboard\/assessments$/);
    await page.goto("/dashboard/assessments/history");
    await expect(items).toHaveCount(1);
    await page.goto(secondUrl);
    await expect(page.getByText("Assessment not found")).toBeVisible();
  });

  test("creates a Job Match assessment and shows Job Match alignment", async ({ page }) => {
    test.setTimeout(120_000);
    await newUserWithCv(page, "AsJob");
    await createJobMatch(page);
    await page.goto("/dashboard/assessments");
    await expect(page.getByRole("radio", { name: /^Job Match/ })).toBeChecked();
    await expect(visible(page, "Skills to test:")).toBeVisible();
    await generate(page);
    await expect(
      page.getByRole("heading", { name: "Assessment for ML Engineer", level: 1 }),
    ).toBeVisible();
    await start(page);
    await expect(page.getByTestId("question-source").filter({ visible: true })).toContainText(
      "Job Match",
    );
    await submitAll(page);
    await expect(page.getByRole("heading", { name: "Job Match Alignment" })).toBeVisible();
    await expect(visible(page, /doesn.t prove job readiness/)).toBeVisible();
  });

  test("creates a Career Goal assessment from the profile goal", async ({ page }) => {
    await newUserWithCv(page, "AsGoal");
    await setCareerGoal(page, "Data Scientist");
    await page.goto("/dashboard/assessments");
    await choose(page, /^Career Goal/);
    await expect(visible(page, "Career goal (from Profile)")).toBeVisible();
    await expect(visible(page, "Statistics").first()).toBeVisible();
    await generate(page);
    await expect(
      page.getByRole("heading", { name: "Data Scientist assessment", level: 1 }),
    ).toBeVisible();
    await start(page);
    await expect(page.getByTestId("question-source").filter({ visible: true })).toContainText(
      /Career goal|CV analysis|Career roadmap/,
    );
  });

  test("expires at the time limit: saves are refused and saved answers are scored", async ({
    page,
  }) => {
    await newUserWithCv(page, "AsExpire");
    await page.goto("/dashboard/assessments");
    await generate(page, { source: "Skill", skill: "Python", limit: "15 minutes" });
    const id = page.url().split("/").pop()!;
    await start(page);
    await page.getByRole("radio", { name: "Dictionary" }).check();
    await save(page);

    // Time travel: the deadline passed (beyond the grace period).
    await dbQuery(
      // Prisma stores UTC in timestamp-without-time-zone columns, so compute the deadline in UTC.
      `UPDATE "Assessment" SET "expiresAt" = (now() AT TIME ZONE 'UTC') - interval '5 minutes' WHERE id = $1`,
      [id],
    );
    await page.getByLabel("Your answer").fill(LONG_ANSWER);
    await page.getByRole("button", { name: "Save answer" }).click();
    // The refused save swaps the runner for the time-up state (the score below proves it wasn't saved).
    await expect(page.getByRole("heading", { name: "Time's up" })).toBeVisible();
    await expect(
      visible(page, "The time limit has passed. Answers you saved in time will be scored."),
    ).toBeVisible();
    await page.getByRole("button", { name: "View results" }).click();
    await expect(page).toHaveURL(/\/results$/, { timeout: 30_000 });
    await expect(visible(page, /Time limit reached/)).toBeVisible();
    await expect(visible(page, "Time expired").first()).toBeVisible();
    await expect(page.getByTestId("raw-score").filter({ visible: true })).toHaveText(
      "1 / 5 points",
    );
  });

  test("prevents duplicate concurrent generation", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await newUserWithCv(page, "AsDup");
    const second = await context.newPage();
    await Promise.all([page.goto("/dashboard/assessments"), second.goto("/dashboard/assessments")]);
    await Promise.all([
      page.getByRole("button", { name: "Generate assessment" }).click(),
      second.getByRole("button", { name: "Generate assessment" }).click(),
    ]);
    for (const p of [page, second]) {
      await expect(p).toHaveURL(/\/dashboard\/assessments\/[a-z0-9]+$/, { timeout: 30_000 });
    }
    expect(new URL(page.url()).pathname).toBe(new URL(second.url()).pathname);
    await page.goto("/dashboard/assessments/history");
    await expect(page.getByTestId("assessment-history-item").filter({ visible: true })).toHaveCount(
      1,
    );
    await context.close();
  });

  test("limits assessment generation per user", async ({ page }) => {
    test.setTimeout(150_000);
    await newUserWithCv(page, "AsLimit");
    for (let i = 0; i < 10; i++) {
      await page.goto("/dashboard/assessments");
      await page.getByRole("button", { name: "Generate assessment" }).click();
      await expect(page).toHaveURL(/\/dashboard\/assessments\/[a-z0-9]+$/, { timeout: 30_000 });
    }
    await page.goto("/dashboard/assessments");
    await page.getByRole("button", { name: "Generate assessment" }).click();
    await expect(visible(page, /You've reached the limit for now/)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/assessments$/);
  });

  test("handles an AI provider failure with a friendly message", async ({ page }) => {
    test.setTimeout(120_000);
    await newUserWithCv(page, "AsFail");
    await createJobMatch(page, "Data Engineer [mock:ai-failure]");
    await page.goto("/dashboard/assessments");
    await page.getByRole("button", { name: "Generate assessment" }).click();
    await expect(page).toHaveURL(/\/dashboard\/assessments\/[a-z0-9]+$/, { timeout: 30_000 });
    await expect(page.getByText("This assessment couldn't be prepared")).toBeVisible({
      timeout: 30_000,
    });
    await expect(visible(page, /The AI returned an unexpected result/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Practice again/ })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/stack|Error:|at Object/);
  });
});

test.describe("AI Assessments access control", () => {
  test("users cannot read, answer, submit or delete another user's assessment", async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const other = await otherContext.newPage();

    await newUserWithCv(owner, "AsOwner");
    await owner.goto("/dashboard/assessments");
    await generate(owner, { source: "Skill", skill: "Python" });
    const ownerUrl = owner.url();
    const ownerId = ownerUrl.split("/").pop()!;
    await start(owner);
    const ownerQuestionId = (await owner
      .getByTestId("question-prompt")
      .filter({ visible: true })
      .getAttribute("data-question-id"))!;

    await newUserWithCv(other, "AsIntruder");
    // Reading: looks exactly like a missing assessment.
    await other.goto(ownerUrl);
    await expect(other.getByText("Assessment not found")).toBeVisible();
    await other.goto(`${ownerUrl}/results`);
    await expect(other.getByText("Assessment not found")).toBeVisible();

    // The intruder's own assessment, with ids swapped in transit.
    await other.goto("/dashboard/assessments");
    await generate(other, { source: "Skill", skill: "Python" });
    const otherId = other.url().split("/").pop()!;
    await start(other);
    const otherQuestionId = (await other
      .getByTestId("question-prompt")
      .filter({ visible: true })
      .getAttribute("data-question-id"))!;

    await tamper(other, "**/dashboard/assessments/*", otherQuestionId, ownerQuestionId);
    await other.getByRole("radio", { name: "List" }).check();
    await other.getByRole("button", { name: "Save answer" }).click();
    await expect(
      visible(other, /This question doesn't exist or you don't have access to it/),
    ).toBeVisible();
    await other.unroute("**/dashboard/assessments/*");

    await tamper(other, "**/dashboard/assessments/*", otherId, ownerId);
    await other.getByRole("button", { name: "Submit assessment" }).click();
    await other.getByRole("button", { name: "Submit anyway" }).click();
    await expect(
      visible(other, /This assessment doesn't exist or you don't have access to it/),
    ).toBeVisible();
    await other.getByRole("button", { name: /^Delete Python assessment/ }).click();
    await other.getByRole("button", { name: "Delete assessment" }).click();
    await expect(
      visible(other, /This assessment doesn't exist or you don't have access to it/).first(),
    ).toBeVisible();

    // The owner's assessment is untouched.
    await owner.reload();
    await expect(visible(owner, "Question 1 of 5")).toBeVisible();
    await expect(owner.getByTestId("assessment-progress").filter({ visible: true })).toHaveText(
      "0 / 5 answered",
    );
    await ownerContext.close();
    await otherContext.close();
  });
});

test.describe("AI Assessments layout", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`works on mobile in the ${theme} theme`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await context.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
      const page = await context.newPage();
      await newUserWithCv(page, `AsMobile${theme}`);
      await page.goto("/dashboard/assessments");
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await generate(page, { source: "Skill", skill: "Python" });
      await start(page);
      expect(await hasHorizontalOverflow(page)).toBe(false);

      // Keyboard: choose an option and save without the mouse.
      await page.getByRole("radio", { name: "List" }).focus();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("radio", { name: "Tuple" })).toBeChecked();
      await page.getByRole("button", { name: "Save answer" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("assessment-progress").filter({ visible: true })).toHaveText(
        "1 / 5 answered",
      );

      await submitAll(page);
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await context.close();
    });
  }
});
