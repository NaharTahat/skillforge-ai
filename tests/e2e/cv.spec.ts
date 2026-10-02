import { expect, test } from "@playwright/test";
import { chooseFile, makeUser, register, uploadAndAnalyze } from "./helpers";

// Assertions use { visible: true }: while streamed content is swapped in, React briefly
// keeps a hidden copy of it in the DOM.

test.describe("CV analyzer", () => {
  test("shows an informative empty state to a new user", async ({ page }) => {
    await register(page, makeUser("Empty"));
    await page.goto("/dashboard/cv");
    await expect(page.getByRole("heading", { name: "CV Analyzer" })).toBeVisible();
    await expect(page.getByText("What you'll get").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("Skills with evidence").filter({ visible: true })).toBeVisible();
  });

  test("uploads a PDF and shows a grounded, labelled report", async ({ page }) => {
    await register(page, makeUser("Pdf"));
    await uploadAndAnalyze(page, "sample-cv.pdf");

    await expect(page.getByRole("heading", { name: "sample-cv.pdf" })).toBeVisible();
    await expect(page.getByText(/Mock analysis\./)).toBeVisible();
    await expect(page.getByText(/of \d+ pts/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Detected skills" })).toBeVisible();
    await expect(page.getByText("Python", { exact: true })).toBeVisible();
    await expect(page.getByText(/Built Python and SQL pipelines/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "CV sections" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Analysis history" })).toBeVisible();
  });

  test("uploads a DOCX and lists it with its score", async ({ page }) => {
    await register(page, makeUser("Docx"));
    await uploadAndAnalyze(page, "sample-cv.docx");

    await page.goto("/dashboard/cv");
    // Streamed content is briefly duplicated (hidden) while React swaps it in.
    const card = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "sample-cv.docx", visible: true });
    await expect(card).toBeVisible();
    await expect(card.getByText("Completed")).toBeVisible();
    await expect(card.getByText("/ 100")).toBeVisible();
    await expect(card.getByText(/DOCX · /)).toBeVisible();
    await card.getByRole("link", { name: "View analysis" }).click();
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible();
  });

  test("rejects unsupported, disguised and scanned files with clear messages", async ({ page }) => {
    await register(page, makeUser("Bad"));

    await chooseFile(page, "not-a-pdf.pdf");
    await page.getByRole("button", { name: "Upload & analyze" }).click();
    await expect(page.getByText(/doesn't look like a valid PDF or DOCX/)).toBeVisible();

    await chooseFile(page, "scanned.pdf");
    await page.getByRole("button", { name: "Upload & analyze" }).click();
    await expect(page.getByText(/Text recognition \(OCR\) isn't supported yet/)).toBeVisible();

    await chooseFile(page, "macro.docx");
    await page.getByRole("button", { name: "Upload & analyze" }).click();
    await expect(page.getByText(/Documents with macros aren't accepted/)).toBeVisible();

    // Nothing unusable was stored.
    await page.goto("/dashboard/cv");
    await expect(page.getByText("What you'll get").filter({ visible: true })).toBeVisible();
  });

  test("re-analysis adds a new history entry and keeps the old report", async ({ page }) => {
    await register(page, makeUser("Again"));
    const cvId = await uploadAndAnalyze(page, "sample-cv.pdf");
    const firstAnalysis = new URL(page.url()).searchParams.get("analysis");

    await page.getByRole("button", { name: "Re-analyze" }).click();
    await expect(page).not.toHaveURL(new RegExp(`analysis=${firstAnalysis}`));
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible({
      timeout: 30_000,
    });

    const historyPanel = page.getByRole("complementary", { name: "Analysis history" });
    await expect(historyPanel.getByRole("listitem")).toHaveCount(2);

    // The earlier analysis is still viewable.
    await page.goto(`/dashboard/cv/${cvId}?analysis=${firstAnalysis}`);
    await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible();
    await expect(historyPanel.locator('a[aria-current="page"]')).toHaveAttribute(
      "href",
      `/dashboard/cv/${cvId}?analysis=${firstAnalysis}`,
    );
  });

  test("deletes a CV after confirmation", async ({ page }) => {
    await register(page, makeUser("Del"));
    const cvId = await uploadAndAnalyze(page, "sample-cv.pdf");

    await page.getByRole("button", { name: "Delete sample-cv.pdf" }).click();
    await expect(page.getByRole("dialog", { name: "Delete this CV?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete CV" }).click();

    await expect(page).toHaveURL(/\/dashboard\/cv$/);
    await expect(page.getByText("What you'll get").filter({ visible: true })).toBeVisible();
    await page.goto(`/dashboard/cv/${cvId}`);
    await expect(page.getByText("CV not found")).toBeVisible();
  });
});

test.describe("CV access control", () => {
  test("users cannot see or open another user's CV", async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const owner = await ownerContext.newPage();
    const other = await otherContext.newPage();
    await register(owner, makeUser("Owner"));
    await register(other, makeUser("Intruder"));

    const cvId = await uploadAndAnalyze(owner, "sample-cv.pdf");
    const analysisId = new URL(owner.url()).searchParams.get("analysis");

    await other.goto(`/dashboard/cv/${cvId}?analysis=${analysisId}`);
    await expect(other.getByText("CV not found")).toBeVisible();
    await expect(other.locator("body")).not.toContainText("sample-cv.pdf");

    await other.goto("/dashboard/cv");
    await expect(other.getByText("What you'll get").filter({ visible: true })).toBeVisible();
    await expect(other.locator("body")).not.toContainText("sample-cv.pdf");

    await ownerContext.close();
    await otherContext.close();
  });

  test("the upload API requires a session and a same-origin request", async ({
    request,
    baseURL,
  }) => {
    const multipart = {
      file: { name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    };
    const anonymous = await request.post("/api/cv", {
      multipart,
      headers: { origin: baseURL! },
    });
    expect(anonymous.status()).toBe(401);

    const crossSite = await request.post("/api/cv", {
      multipart,
      headers: { origin: "https://evil.example" },
    });
    expect(crossSite.status()).toBe(403);
  });

  test("CV pages require authentication", async ({ page }) => {
    await page.goto("/dashboard/cv/some-cv-id");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });
});
