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

/** At least 40 words: the mock evaluator rates it a strong, detailed answer. */
const LONG_ANSWER =
  "In my churn predictor project I built a Python pipeline with scikit-learn and SQL feature queries. " +
  "I started by defining the target clearly, then checked the data for leakage by splitting on time, " +
  "compared three models with cross-validation, and deployed the best one behind a REST API with monitoring. " +
  "The result was a measurable improvement in recall, and I documented the trade-offs for the team.";
/** Under 12 words: the mock evaluator asks for more evidence and suggests a follow-up. */
const SHORT_ANSWER = "I would read the documentation first.";

const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });
const questionHeading = (page: Page) =>
  page.getByTestId("question-prompt").filter({ visible: true });

async function userWithAnalyzedCv(page: Page, name: string) {
  await register(page, makeUser(name));
  await uploadAndAnalyze(page, "sample-cv.pdf");
}

async function createJobMatch(page: Page, jobTitle = "ML Engineer") {
  await page.goto("/dashboard/job-match");
  await page.getByText("sample-cv.pdf").filter({ visible: true }).click();
  await page.getByLabel("Job title (optional)").fill(jobTitle);
  await page.getByLabel("Company (optional)").fill("Northwind Labs");
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

/** Starts an interview from the create form (source already selected) and waits for question 1. */
async function startInterview(page: Page, options: { count?: 5 | 10 | 15; type?: string } = {}) {
  if (options.type)
    await page.getByText(options.type, { exact: true }).filter({ visible: true }).click();
  await page
    .getByText(`${options.count ?? 5} questions`, { exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Start interview" }).click();
  await waitForQuestion(page, 1, options.count ?? 5);
}

async function waitForQuestion(page: Page, n: number, total: number) {
  await expect(page).toHaveURL(/\/dashboard\/interview\/[a-z0-9]+$/, { timeout: 30_000 });
  await expect(visible(page, `Question ${n} of ${total}`)).toBeVisible({ timeout: 30_000 });
}

async function answer(page: Page, text: string) {
  await page.getByLabel("Your answer").fill(text);
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("answer-feedback").filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

/** Rewrites an outgoing server-action body on `urlGlob`, replacing `from` with `to`. */
async function tamper(page: Page, urlGlob: string, from: string, to: string) {
  await page.route(urlGlob, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      const body = request.postData() ?? "";
      await route.continue({ postData: body.replaceAll(from, to) });
    } else {
      await route.continue();
    }
  });
}

test.describe("AI Interview", () => {
  test("requires authentication", async ({ page }) => {
    await page.goto("/dashboard/interview");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard%2Finterview$/);
    await page.goto("/dashboard/interview/some-interview-id");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test("shows the right empty states", async ({ page }) => {
    await register(page, makeUser("NoCv"));
    await page.goto("/dashboard/interview");
    await expect(page.getByRole("heading", { name: "AI Interview", level: 1 })).toBeVisible();
    await expect(visible(page, "Analyze your CV first to start an AI interview.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to CV Analyzer" })).toHaveAttribute(
      "href",
      "/dashboard/cv",
    );
    await expect(visible(page, "No interviews yet")).toBeVisible();

    // With an analyzed CV but no job match and no career goal.
    await uploadAndAnalyze(page, "sample-cv.pdf");
    await page.goto("/dashboard/interview");
    await expect(visible(page, "Set your career goal in Profile first.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Profile" })).toHaveAttribute(
      "href",
      "/dashboard/profile",
    );
    await page.getByText("Job Match interview").filter({ visible: true }).click();
    await expect(
      visible(page, "Create a Job Match first to generate a job-specific interview."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Job Match" })).toHaveAttribute(
      "href",
      "/dashboard/job-match",
    );
  });

  test("runs a full Job Match interview: feedback, follow-ups, progress, completion and report", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await userWithAnalyzedCv(page, "FullFlow");
    await createJobMatch(page);
    await page.goto("/dashboard/interview");

    // The Job Match source is recommended and shows the match details.
    await expect(visible(page, "Interview for:")).toBeVisible();
    await expect(visible(page, "Northwind Labs")).toBeVisible();
    await expect(visible(page, /^\d+\/100$/).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: "Mixed" })).toBeChecked();
    await expect(visible(page, "Recommended").first()).toBeVisible();
    await startInterview(page, { count: 5 });

    // Question display with its source and reason.
    await expect(
      page.getByRole("heading", { name: "Interview for ML Engineer", level: 1 }),
    ).toBeVisible();
    await expect(page.getByTestId("question-source").filter({ visible: true })).toContainText(
      "Reason:",
    );
    await expect(visible(page, "0 / 5").first()).toBeVisible();

    // Q1: a detailed answer gets strong feedback.
    await answer(page, LONG_ANSWER);
    await expect(visible(page, "Strong answer")).toBeVisible();
    for (const label of ["Relevance", "Completeness", "Clarity", "Communication", "Evidence"]) {
      await expect(page.getByTestId("answer-feedback").filter({ visible: true })).toContainText(
        label,
      );
    }
    await expect(visible(page, "Improvement suggestion:")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(visible(page, "Question 2 of 5")).toBeVisible();
    await expect(page.getByTestId("interview-progress").filter({ visible: true })).toHaveText(
      "1 / 5",
    );
    await expect(
      page.getByRole("progressbar", { name: "Interview progress" }).filter({ visible: true }),
    ).toHaveAttribute("aria-valuenow", "20");

    // Q2: short answers trigger at most two follow-ups.
    await answer(page, SHORT_ANSWER);
    await expect(visible(page, "Needs more evidence")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(visible(page, "Follow-up 1 · Question 2 of 5")).toBeVisible();
    await answer(page, SHORT_ANSWER);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(visible(page, "Follow-up 2 · Question 2 of 5")).toBeVisible();
    await answer(page, SHORT_ANSWER);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(visible(page, "Question 3 of 5")).toBeVisible();
    await expect(visible(page, "Follow-up 3")).toHaveCount(0);

    // Q3 skipped, Q4–Q5 answered.
    await page.getByRole("button", { name: "Skip question" }).click();
    await expect(visible(page, "Question 4 of 5")).toBeVisible();
    await answer(page, LONG_ANSWER);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(visible(page, "Question 5 of 5")).toBeVisible();
    await answer(page, LONG_ANSWER);

    // Completion and final report.
    await page.getByRole("button", { name: "Finish interview" }).click();
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("overall-score").filter({ visible: true })).toContainText(
      "/ 100",
    );
    await expect(visible(page, "6 answered · 1 skipped")).toBeVisible();
    for (const heading of [
      "Strengths",
      "Improvement areas",
      "Questions to review",
      "Recommendations",
      "Next practice",
      "Full transcript",
    ]) {
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Category scores" })).toBeVisible();
    await expect(visible(page, /deterministic mock provider/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/you (don't|do not) know|you lack/i);

    // History.
    await page.goto("/dashboard/interview");
    await page.reload();
    const item = page.getByTestId("interview-history-item").filter({ visible: true });
    await expect(item).toHaveCount(1);
    await expect(item.first()).toContainText("Completed");
    await expect(item.first()).toContainText("/ 100");
  });

  test("creates a Career Goal interview from the profile goal", async ({ page }) => {
    await userWithAnalyzedCv(page, "Career");
    await setCareerGoal(page, "Data Scientist");
    await page.goto("/dashboard/interview");
    await expect(page.getByRole("radio", { name: /Career Goal Interview/ })).toBeChecked();
    await expect(visible(page, "Career goal (from Profile)")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Job requirements" })).toHaveCount(0);
    await startInterview(page, { count: 5, type: "Technical" });
    await expect(
      page.getByRole("heading", { name: "Career Goal Interview: Data Scientist", level: 1 }),
    ).toBeVisible();
    await expect(visible(page, "Career Goal Interview · not tied to a specific job")).toBeVisible();
    await expect(page.getByTestId("question-source").filter({ visible: true })).toContainText(
      /Career goal|Your CV|CV analysis|Career roadmap/,
    );
  });

  test("practice again creates a new interview, keeps the old one, and deletes", async ({
    page,
  }) => {
    await userWithAnalyzedCv(page, "Again");
    await setCareerGoal(page, "Data Analyst");
    await page.goto("/dashboard/interview");
    await startInterview(page, { count: 5 });
    const firstUrl = page.url();

    await page.getByRole("button", { name: /^Practice again/ }).click();
    await expect(page).not.toHaveURL(firstUrl, { timeout: 30_000 });
    await waitForQuestion(page, 1, 5);
    await expect(visible(page, /A new practice of an earlier interview/)).toBeVisible();
    const secondUrl = page.url();

    await page.goto("/dashboard/interview");
    const items = page.getByTestId("interview-history-item").filter({ visible: true });
    await expect(items).toHaveCount(2);
    await page.goto(firstUrl);
    await expect(visible(page, "Question 1 of 5")).toBeVisible();

    await page.goto(secondUrl);
    await page.getByRole("button", { name: /^Delete .*interview/ }).click();
    await page.getByRole("button", { name: "Delete interview" }).click();
    await expect(page).toHaveURL(/\/dashboard\/interview$/);
    await expect(items).toHaveCount(1);
    await page.goto(secondUrl);
    await expect(page.getByText("Interview not found")).toBeVisible();
  });

  test("prevents duplicate concurrent generation", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await userWithAnalyzedCv(page, "Dup");
    await setCareerGoal(page, "Data Analyst");
    const second = await context.newPage();
    await Promise.all([page.goto("/dashboard/interview"), second.goto("/dashboard/interview")]);
    await Promise.all([
      page.getByRole("button", { name: "Start interview" }).click(),
      second.getByRole("button", { name: "Start interview" }).click(),
    ]);
    await waitForQuestion(page, 1, 10);
    await waitForQuestion(second, 1, 10);
    expect(new URL(page.url()).pathname).toBe(new URL(second.url()).pathname);
    await page.goto("/dashboard/interview");
    await expect(page.getByTestId("interview-history-item").filter({ visible: true })).toHaveCount(
      1,
    );
    await context.close();
  });

  test("limits interview generation per user", async ({ page }) => {
    test.setTimeout(150_000);
    await userWithAnalyzedCv(page, "Limit");
    await setCareerGoal(page, "Data Analyst");
    for (let i = 0; i < 10; i++) {
      await page.goto("/dashboard/interview");
      await page.getByRole("button", { name: "Start interview" }).click();
      await expect(page).toHaveURL(/\/dashboard\/interview\/[a-z0-9]+$/, { timeout: 30_000 });
    }
    await page.goto("/dashboard/interview");
    await page.getByRole("button", { name: "Start interview" }).click();
    await expect(visible(page, /You've reached the limit for now/)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/interview$/);
  });

  test("handles invalid settings, empty answers and answers to a completed interview", async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await userWithAnalyzedCv(page, "Errors");
    await setCareerGoal(page, "Data Analyst");

    // A tampered question count is rejected with a friendly message.
    await tamper(page, "**/dashboard/interview", '"questionCount":5', '"questionCount":7');
    await page.goto("/dashboard/interview");
    await page.getByText("5 questions", { exact: true }).filter({ visible: true }).click();
    await page.getByRole("button", { name: "Start interview" }).click();
    await expect(visible(page, "Check the interview settings and try again.")).toBeVisible();
    await page.unroute("**/dashboard/interview");

    await startInterview(page, { count: 5 });
    const url = page.url();
    // Empty answers can't be submitted.
    await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled();

    // A second tab still shows question 5 while the first tab finishes the interview.
    for (let i = 1; i <= 4; i++) {
      await page.getByRole("button", { name: "Skip question" }).click();
      await expect(visible(page, `Question ${i + 1} of 5`)).toBeVisible();
    }
    const stale = await context.newPage();
    await stale.goto(url);
    await expect(visible(stale, "Question 5 of 5")).toBeVisible();
    await page.getByRole("button", { name: "Skip question" }).click();
    await page.getByRole("button", { name: "Finish interview" }).click();
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible({
      timeout: 30_000,
    });

    await stale.getByLabel("Your answer").fill(LONG_ANSWER);
    await stale.getByRole("button", { name: "Submit answer" }).click();
    await expect(visible(stale, /already completed/)).toBeVisible();
    await context.close();
  });
});

test.describe("AI Interview access control", () => {
  test("users cannot open, answer, skip or delete another user's interview", async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const other = await otherContext.newPage();

    await userWithAnalyzedCv(owner, "Owner");
    await setCareerGoal(owner, "Data Analyst");
    await owner.goto("/dashboard/interview");
    await startInterview(owner, { count: 5 });
    const ownerUrl = owner.url();
    const ownerInterviewId = ownerUrl.split("/").pop()!;
    const ownerQuestionId = (await questionHeading(owner).getAttribute("data-question-id"))!;
    const ownerQuestion = (await questionHeading(owner).textContent())!;

    await userWithAnalyzedCv(other, "Intruder");
    await setCareerGoal(other, "Data Analyst");

    // Opening the owner's interview looks exactly like a missing one.
    await other.goto(ownerUrl);
    await expect(other.getByText("Interview not found")).toBeVisible();
    await expect(other.locator("body")).not.toContainText(ownerQuestion);

    // Answering and skipping the owner's question (ids swapped in transit) are refused.
    await other.goto("/dashboard/interview");
    await startInterview(other, { count: 5 });
    const otherInterviewId = other.url().split("/").pop()!;
    const otherQuestionId = (await questionHeading(other).getAttribute("data-question-id"))!;
    await tamper(other, "**/dashboard/interview/*", otherQuestionId, ownerQuestionId);
    await other.getByLabel("Your answer").fill("Injected answer for someone else's interview.");
    await other.getByRole("button", { name: "Submit answer" }).click();
    await expect(
      visible(other, /This question doesn't exist or you don't have access to it/),
    ).toBeVisible();
    await other.getByRole("button", { name: "Skip question" }).click();
    await expect(
      visible(other, /This question doesn't exist or you don't have access to it/).first(),
    ).toBeVisible();
    await other.unroute("**/dashboard/interview/*");

    // Deleting the owner's interview (id swapped in transit) is refused.
    await tamper(other, "**/dashboard/interview/*", otherInterviewId, ownerInterviewId);
    await other.getByRole("button", { name: /^Delete .*interview/ }).click();
    await other.getByRole("button", { name: "Delete interview" }).click();
    await expect(
      visible(other, /This interview doesn't exist or you don't have access to it/),
    ).toBeVisible();

    // The owner's interview is untouched.
    await owner.reload();
    await expect(visible(owner, "Question 1 of 5")).toBeVisible();
    await expect(owner.getByTestId("interview-progress").filter({ visible: true })).toHaveText(
      "0 / 5",
    );
    await expect(owner.locator("body")).not.toContainText("Injected answer");

    await ownerContext.close();
    await otherContext.close();
  });
});

test.describe("AI Interview layout", () => {
  for (const theme of ["dark", "light"] as const) {
    test(`works on mobile in the ${theme} theme`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
      await context.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
      const page = await context.newPage();
      await userWithAnalyzedCv(page, `Mobile${theme}`);
      await createJobMatch(
        page,
        "Senior Machine Learning Engineer, Platform & Infrastructure Team",
      );
      await page.goto("/dashboard/interview");
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await startInterview(page, { count: 5 });
      expect(await hasHorizontalOverflow(page)).toBe(false);
      // Question navigation collapses into a compact progress indicator.
      await expect(page.getByRole("navigation", { name: "Questions" })).toBeHidden();
      await expect(page.getByTestId("interview-progress").filter({ visible: true })).toHaveText(
        "0 / 5",
      );

      // Keyboard: type an answer and submit it without the mouse.
      await page.getByLabel("Your answer").focus();
      await page.keyboard.type(LONG_ANSWER);
      await page.getByRole("button", { name: "Submit answer" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("answer-feedback").filter({ visible: true })).toBeVisible({
        timeout: 30_000,
      });
      expect(await hasHorizontalOverflow(page)).toBe(false);

      await page.goto("/dashboard/interview");
      await expect(page.getByRole("heading", { name: "Your interviews" })).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await context.close();
    });
  }
});
