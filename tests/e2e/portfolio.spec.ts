import { expect, test, type Browser, type Page } from "@playwright/test";
import { dbQuery } from "./db";
import { makeUser, register, type TestUser } from "./helpers";

// Streamed content is briefly duplicated (hidden) while React swaps it in,
// so element lookups filter to visible elements.

const byId = (page: Page, id: string) => page.locator(`[id="${id}"]`).filter({ visible: true });
const visible = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });
const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name }).filter({ visible: true });

const NOT_FOUND = "This item doesn't exist or you don't have access to it.";
const PROJECT_NOT_FOUND = "This project doesn't exist or you don't have access to it.";

function uniqueName(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

/** Rewrites the body of server-action POSTs on matching pages (request tampering). */
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

async function newUser(page: Page, name: string): Promise<TestUser> {
  const user = makeUser(name);
  await register(page, user);
  return user;
}

async function addSkill(page: Page, name: string, visibility: "PRIVATE" | "PUBLIC" = "PRIVATE") {
  await page.goto("/dashboard/portfolio/skills");
  await byId(page, "skill-name").fill(name);
  await byId(page, "skill-visibility").selectOption(visibility);
  await button(page, "Add skill").click();
  await expect(
    page.getByTestId("skill-row").filter({ hasText: name }).filter({ visible: true }),
  ).toBeVisible();
}

type ProjectOptions = {
  title: string;
  short?: string;
  skills?: string[];
  technologies?: string;
  visibility?: "PRIVATE" | "PUBLIC";
};

/** Creates a project through the form; returns its id. */
async function createProject(page: Page, o: ProjectOptions): Promise<string> {
  await page.goto("/dashboard/portfolio/projects/new");
  await byId(page, "title").fill(o.title);
  await byId(page, "shortDescription").fill(o.short ?? "A dashboard that predicts customer churn.");
  if (o.technologies) {
    await byId(page, "tech-input").fill(o.technologies);
    await button(page, "Add").click();
  }
  for (const s of o.skills ?? [])
    await page.getByRole("checkbox", { name: s, exact: true }).check();
  if (o.visibility) await byId(page, "visibility").selectOption(o.visibility);
  await button(page, "Create project").click();
  await expect(page).toHaveURL(/\/dashboard\/portfolio\/projects\/[a-z0-9]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: o.title, level: 1 })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function addSection(
  page: Page,
  kind: "education" | "certification" | "achievement" | "experience",
  fields: Record<string, string>,
  visibility: "PRIVATE" | "PUBLIC" = "PRIVATE",
) {
  await page.goto("/dashboard/portfolio/edit");
  await button(page, `Add ${kind}`).first().click();
  const dialog = page.getByRole("dialog");
  for (const [key, value] of Object.entries(fields)) {
    const field = dialog.locator(`[id="${kind}-new-${key}"]`);
    if ((await field.evaluate((el) => el.tagName)) === "SELECT") await field.selectOption(value);
    else await field.fill(value);
  }
  await dialog.locator(`[id="${kind}-new-visibility"]`).selectOption(visibility);
  await dialog.getByRole("button", { name: `Add ${kind}` }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .getByTestId(`${kind}-item`)
      .filter({ hasText: Object.values(fields)[0]! })
      .filter({ visible: true }),
  ).toBeVisible();
}

async function makePublic(page: Page, username: string) {
  await page.goto("/dashboard/portfolio/settings");
  await byId(page, "username").fill(username);
  await byId(page, "isPublic").check();
  await button(page, "Save settings").click();
  await expect(visible(page, "Saved. Your portfolio is public.")).toBeVisible();
}

async function saveProfile(
  page: Page,
  values: { headline?: string; bio?: string; location?: string },
) {
  await page.goto("/dashboard/portfolio/edit");
  if (values.headline !== undefined) await byId(page, "headline").fill(values.headline);
  if (values.bio !== undefined) await byId(page, "bio").fill(values.bio);
  if (values.location !== undefined) await byId(page, "location").fill(values.location);
  await button(page, "Save profile").click();
  await expect(visible(page, "Profile saved")).toBeVisible();
}

/** A public portfolio with a public project, a public skill and a private project/cert. */
async function publicPortfolio(page: Page, name: string) {
  const user = await newUser(page, name);
  const username = uniqueName("pub");
  await saveProfile(page, {
    headline: "Junior Data Analyst",
    bio: "I analyse data with Python.",
    location: "Lyon",
  });
  await addSkill(page, "Python", "PUBLIC");
  await addSkill(page, "Rust", "PRIVATE");
  await createProject(page, {
    title: "Public Churn Dashboard",
    skills: ["Python"],
    technologies: "Pandas",
    visibility: "PUBLIC",
  });
  await createProject(page, { title: "Secret Side Project", visibility: "PRIVATE" });
  await addSection(page, "certification", { name: "Hidden Cert", issuer: "Nobody" }, "PRIVATE");
  await makePublic(page, username);
  return { user, username };
}

test.describe("Portfolio", () => {
  test("requires authentication on every portfolio route", async ({ page }) => {
    for (const path of [
      "/dashboard/portfolio",
      "/dashboard/portfolio/edit",
      "/dashboard/portfolio/projects",
      "/dashboard/portfolio/projects/new",
      "/dashboard/portfolio/projects/x1",
      "/dashboard/portfolio/skills",
      "/dashboard/portfolio/settings",
      "/dashboard/skill-passport",
      "/dashboard/skill-passport/x1",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    }
  });

  test("1. shows an empty portfolio with real zero stats and next steps", async ({ page }) => {
    await newUser(page, "PfEmpty");
    await page.goto("/dashboard/portfolio");
    await expect(page.getByRole("heading", { name: "Portfolio", level: 1 })).toBeVisible();
    await expect(page.getByTestId("portfolio-empty").filter({ visible: true })).toBeVisible();
    await expect(visible(page, "1 of 10 steps done. Each step counts equally.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add your first project" })).toBeVisible();
    await expect(page.getByTestId("portfolio-public-status").filter({ visible: true })).toHaveText(
      "Private",
    );
    await page.goto("/dashboard/portfolio/projects");
    await expect(visible(page, "No projects yet")).toBeVisible();
  });

  test("2. creates a profile", async ({ page }) => {
    await newUser(page, "PfCreate");
    await saveProfile(page, {
      headline: "Aspiring Data Analyst",
      bio: "I like data.",
      location: "Paris",
    });
    await page.reload();
    await expect(byId(page, "headline")).toHaveValue("Aspiring Data Analyst");
    await expect(byId(page, "location")).toHaveValue("Paris");
    await page.goto("/dashboard/portfolio");
    await expect(page.getByTestId("portfolio-headline").filter({ visible: true })).toHaveText(
      "Aspiring Data Analyst",
    );
  });

  test("3. edits the headline", async ({ page }) => {
    await newUser(page, "PfHeadline");
    await saveProfile(page, { headline: "First headline" });
    await saveProfile(page, { headline: "Second headline" });
    await page.goto("/dashboard/portfolio");
    await expect(page.getByTestId("portfolio-headline").filter({ visible: true })).toHaveText(
      "Second headline",
    );
  });

  test("4. edits the bio and validates its length", async ({ page }) => {
    await newUser(page, "PfBio");
    await saveProfile(page, { bio: "Original bio." });
    await saveProfile(page, { bio: "Updated bio about my data work." });
    await page.reload();
    await expect(byId(page, "bio")).toHaveValue("Updated bio about my data work.");
    await expect(visible(page, /31\/600 characters/)).toBeVisible();
  });

  test("5. creates a project (private by default)", async ({ page }) => {
    await newUser(page, "PfProject");
    await createProject(page, { title: "Churn Dashboard", technologies: "Python, Pandas" });
    await page.goto("/dashboard/portfolio/projects");
    const card = page
      .getByTestId("project-card")
      .filter({ hasText: "Churn Dashboard" })
      .filter({ visible: true });
    await expect(card).toBeVisible();
    await expect(card.getByText("Private", { exact: true })).toBeVisible();
    await expect(card.getByText("2 technologies")).toBeVisible();
  });

  test("6. edits a project and validates input", async ({ page }) => {
    await newUser(page, "PfEditProject");
    await createProject(page, { title: "Old Title" });
    await byId(page, "title").fill("New Title");
    await byId(page, "repositoryUrl").fill("javascript:alert(1)");
    await button(page, "Save project").click();
    await expect(visible(page, "Repository URL must be a valid http(s) URL")).toBeVisible();
    await byId(page, "repositoryUrl").fill("https://github.com/me/new");
    await button(page, "Save project").click();
    await expect(visible(page, "Project saved")).toBeVisible();
    await page.goto("/dashboard/portfolio/projects");
    await expect(
      page.getByTestId("project-card").filter({ hasText: "New Title" }).filter({ visible: true }),
    ).toBeVisible();
    await expect(visible(page, "Old Title")).toHaveCount(0);
  });

  test("7. deletes a project after confirmation", async ({ page }) => {
    await newUser(page, "PfDelete");
    await createProject(page, { title: "Doomed Project" });
    await page.goto("/dashboard/portfolio/projects");
    await page
      .getByRole("button", { name: "Delete Doomed Project" })
      .filter({ visible: true })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(visible(page, "Project deleted")).toBeVisible();
    await expect(visible(page, "No projects yet")).toBeVisible();
  });

  test("8. creates a skill and rejects duplicates", async ({ page }) => {
    await newUser(page, "PfSkill");
    await addSkill(page, "Python");
    const row = page
      .getByTestId("skill-row")
      .filter({ hasText: "Python" })
      .filter({ visible: true });
    await expect(row.getByText("Evidence: Self-reported only")).toBeVisible();
    await expect(row.getByText("Private", { exact: true })).toBeVisible();
    await byId(page, "skill-name").fill("python");
    await button(page, "Add skill").click();
    await expect(visible(page, "This skill is already in your list.")).toBeVisible();
    await expect(page.getByTestId("skill-row").filter({ visible: true })).toHaveCount(1);
  });

  test("9. links a skill to a project as evidence", async ({ page }) => {
    await newUser(page, "PfLink");
    await addSkill(page, "Python");
    await createProject(page, { title: "Linked Project", skills: ["Python"] });
    await expect(page.getByRole("checkbox", { name: "Python", exact: true })).toBeChecked();
    await page.goto("/dashboard/skill-passport");
    const card = page
      .getByTestId("passport-skill")
      .filter({ hasText: "Python" })
      .filter({ visible: true });
    await expect(card.getByText("Linked Project")).toBeVisible();
    await expect(card.getByText("Evidence: Limited")).toBeVisible();
  });

  test("10. adds a certification (shown as user-provided)", async ({ page }) => {
    await newUser(page, "PfCert");
    await addSection(page, "certification", {
      name: "AWS Cloud Practitioner",
      issuer: "Amazon Web Services",
      skills: "Python",
    });
    const item = page.getByTestId("certification-item").filter({ visible: true });
    await expect(item.getByText("User-provided · not verified by SkillForge")).toBeVisible();
    await expect(item.getByText("Private", { exact: true })).toBeVisible();
  });

  test("11. adds an achievement", async ({ page }) => {
    await newUser(page, "PfAchieve");
    await addSection(page, "achievement", {
      title: "City Hackathon finalist",
      kind: "HACKATHON",
      issuer: "City Tech Week",
    });
    await expect(
      page
        .getByTestId("achievement-item")
        .filter({ visible: true })
        .getByText("Hackathon · City Tech Week"),
    ).toBeVisible();
  });

  test("12. adds and edits education", async ({ page }) => {
    await newUser(page, "PfEdu");
    await addSection(page, "education", {
      institution: "University of Lyon",
      degree: "BSc",
      field: "Statistics",
      startDate: "2020-09-01",
      endDate: "2023-06-30",
    });
    const item = page.getByTestId("education-item").filter({ visible: true });
    await expect(item.getByText("Sep 2020 – Jun 2023")).toBeVisible();
    await item.getByRole("button", { name: "Edit University of Lyon" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("textarea").fill("Focus on applied statistics.");
    await dialog.locator("input[type=date]").last().fill("2019-01-01");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.getByText("End date must be after the start date")).toBeVisible();
    await dialog.locator("input[type=date]").last().fill("2023-07-01");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(visible(page, "Education updated")).toBeVisible();
  });

  test("13. toggles a project between public and private", async ({ page }) => {
    await newUser(page, "PfToggleProject");
    await createProject(page, { title: "Toggle Me" });
    await page.goto("/dashboard/portfolio/projects");
    const card = page
      .getByTestId("project-card")
      .filter({ hasText: "Toggle Me" })
      .filter({ visible: true });
    await card.getByRole("button", { name: "Make public: Toggle Me" }).click();
    await expect(card.getByText("Public", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Make private: Toggle Me" }).click();
    await expect(card.getByText("Private", { exact: true })).toBeVisible();
  });

  test("14. toggles the whole portfolio between public and private", async ({ page }) => {
    await newUser(page, "PfTogglePortfolio");
    const username = uniqueName("tog");
    await page.goto("/dashboard/portfolio/settings");
    await byId(page, "isPublic").check();
    await button(page, "Save settings").click();
    await expect(
      visible(page, "Choose a username before making your portfolio public."),
    ).toBeVisible();

    await makePublic(page, username);
    let response = await page.goto(`/p/${username}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PfTogglePortfolio Tester");

    await page.goto("/dashboard/portfolio/settings");
    await byId(page, "isPublic").uncheck();
    await button(page, "Save settings").click();
    await expect(visible(page, "Saved. Your portfolio is private.")).toBeVisible();
    response = await page.goto(`/p/${username}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Portfolio not available" })).toBeVisible();
  });

  test("15. renders the public portfolio, project and skills pages with SEO metadata", async ({
    page,
  }) => {
    const { username } = await publicPortfolio(page, "PfPublic");
    await page.goto(`/p/${username}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("PfPublic Tester");
    await expect(visible(page, "Junior Data Analyst")).toBeVisible();
    await expect(visible(page, "I analyse data with Python.")).toBeVisible();
    await expect(page.getByTestId("public-project").filter({ visible: true })).toHaveCount(1);
    await expect(page).toHaveTitle(/PfPublic Tester — Portfolio/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/p/${username}$`),
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /PfPublic Tester/,
    );

    await page.getByRole("link", { name: "Public Churn Dashboard", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${username}/projects/public-churn-dashboard$`));
    await expect(
      page.getByRole("heading", { name: "Public Churn Dashboard", level: 1 }),
    ).toBeVisible();
    await expect(visible(page, "Pandas")).toBeVisible();

    await page.goto(`/p/${username}/skills`);
    await expect(page.getByRole("heading", { name: "Skill Passport", level: 1 })).toBeVisible();
    const skill = page.getByTestId("public-skill").filter({ visible: true });
    await expect(skill).toHaveCount(1);
    await expect(skill.getByText("Beginner · self-assessed")).toBeVisible();
    await expect(skill.getByRole("link", { name: "Public Churn Dashboard" })).toBeVisible();
  });

  test("16. hides private content, contact details and internal ids", async ({ page }) => {
    const { user, username } = await publicPortfolio(page, "PfPrivate");
    await page.goto(`/p/${username}`);
    const html = await page.content();
    expect(html).not.toContain("Secret Side Project");
    expect(html).not.toContain("Hidden Cert");
    expect(html).not.toContain(user.email);
    expect(html).not.toMatch(/\bRust\b/);
    const ids = await dbQuery('SELECT id FROM "Project" WHERE title IN ($1, $2)', [
      "Public Churn Dashboard",
      "Secret Side Project",
    ]);
    for (const r of ids.rows) expect(html).not.toContain(r.id as string);
    const secret = await page.goto(`/p/${username}/projects/secret-side-project`);
    expect(secret?.status()).toBe(404);
    // Visitors see no dashboard controls and can't reach the owner's dashboard.
    await expect(page.getByRole("button", { name: /Delete|Make public|Edit/ })).toHaveCount(0);
  });

  test("17. copies the public link and shows a QR code for it", async ({ page, baseURL }) => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
    await newUser(page, "PfCopy");
    const username = uniqueName("copy");
    await makePublic(page, username);
    await page.reload();
    await expect(page.getByTestId("portfolio-qr").filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId("public-url").filter({ visible: true })).toHaveText(
      new RegExp(`/p/${username}$`),
    );
    await button(page, "Copy public link").click();
    await expect(visible(page, "Link copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${baseURL}/p/${username}`,
    );
    await button(page, "Share Skill Passport").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${baseURL}/p/${username}/skills`,
    );
  });

  test("18. shows the Skill Passport from the navigation", async ({ page }) => {
    await newUser(page, "PfPassport");
    await page.goto("/dashboard");
    await expect(
      page.locator('a[href="/dashboard/skill-passport"]').filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.locator('a[href="/dashboard/portfolio"]').filter({ visible: true }),
    ).toHaveCount(1);
    await page.locator('a[href="/dashboard/skill-passport"]').filter({ visible: true }).click();
    await expect(page.getByRole("heading", { name: "Skill Passport", level: 1 })).toBeVisible();
    await expect(visible(page, "No skills in your passport yet")).toBeVisible();
    await page.goto("/dashboard/passport");
    await expect(page).toHaveURL(/\/dashboard\/skill-passport$/);
    await addSkill(page, "SQL");
    await page.goto("/dashboard/skill-passport");
    const card = page.getByTestId("passport-skill").filter({ visible: true });
    await expect(card.getByText("Evidence: Self-reported only")).toBeVisible();
    await expect(card.getByText("Never")).toBeVisible();
  });

  test("19. lists skill evidence and writes a grounded AI summary", async ({ page }) => {
    await newUser(page, "PfEvidence");
    await addSkill(page, "Python");
    await createProject(page, { title: "Evidence Project", skills: ["Python"] });
    await addSection(page, "certification", {
      name: "Python Basics",
      issuer: "Example Academy",
      skills: "Python",
    });
    await page.goto("/dashboard/skill-passport");
    await page
      .getByRole("link", { name: "View evidence for Python" })
      .filter({ visible: true })
      .click();
    await expect(page.getByRole("heading", { name: "Python", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Evidence Project/ })).toBeVisible();
    await expect(visible(page, "Certifications (user-provided)")).toBeVisible();
    await expect(visible(page, "Evidence (2)")).toBeVisible();
    await button(page, "Generate summary with AI").click();
    await expect(byId(page, "skill-summary")).toHaveValue(
      /^Python is supported by: Evidence Project/,
    );
    await button(page, "Save summary").click();
    await expect(visible(page, "Summary saved")).toBeVisible();
  });

  test("20. generates a headline with AI from the user's own data only", async ({ page }) => {
    await newUser(page, "PfAiHeadline");
    await page.goto("/dashboard/portfolio/edit");
    await button(page, "Generate headline with AI").click();
    await expect(visible(page, /Add a little information first/).first()).toBeVisible();
    await addSkill(page, "Python");
    await addSkill(page, "SQL");
    await addSection(page, "experience", { title: "Data Intern", company: "Acme Analytics" });
    await button(page, "Generate headline with AI").click();
    await expect(byId(page, "headline")).toHaveValue("Data Intern | Python · SQL");
    await expect(visible(page, /AI suggestion added to the headline/)).toBeVisible();
    await button(page, "Save profile").click();
    await expect(visible(page, "Profile saved")).toBeVisible();
  });

  test("21. generates a bio with AI and can regenerate it", async ({ page }) => {
    await newUser(page, "PfAiBio");
    await addSkill(page, "Python");
    await page.goto("/dashboard/portfolio/edit");
    await button(page, "Generate bio with AI").click();
    await expect(byId(page, "bio")).toHaveValue("I work with Python.");
    await expect(button(page, "Regenerate bio")).toBeVisible();
    // Manual edit still possible.
    await byId(page, "bio").fill("I work with Python every day.");
    await button(page, "Save profile").click();
    await expect(visible(page, "Profile saved")).toBeVisible();
  });

  test("22. improves a project description with AI", async ({ page }) => {
    await newUser(page, "PfAiProject");
    await page.goto("/dashboard/portfolio/projects/new");
    await byId(page, "title").fill("Churn Dashboard");
    await byId(page, "shortDescription").fill("A dashboard that predicts customer churn.");
    await byId(page, "tech-input").fill("Python");
    await button(page, "Add").click();
    await button(page, "Improve with AI").click();
    await expect(byId(page, "description")).toHaveValue(
      "Churn Dashboard: A dashboard that predicts customer churn.\n\nHighlights:\n- Built with Python.",
    );
    await expect(visible(page, /AI suggestion added to the description/)).toBeVisible();
  });

  test("23. handles an AI provider failure safely", async ({ page }) => {
    await newUser(page, "PfAiFail");
    await page.goto("/dashboard/portfolio/projects/new");
    await byId(page, "title").fill("Broken [mock:ai-failure]");
    await byId(page, "shortDescription").fill("Anything.");
    await button(page, "Improve with AI").click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "The AI returned an unexpected result. Please try again." })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expect(byId(page, "description")).toHaveValue("");
    // The form still works.
    await button(page, "Create project").click();
    await expect(page).toHaveURL(/\/dashboard\/portfolio\/projects\/[a-z0-9]+$/);
  });

  test("24. blocks access to another user's project and skill (IDOR)", async ({ page }) => {
    await newUser(page, "PfOwnerB");
    await addSkill(page, "Python");
    const projectB = await createProject(page, { title: "B Private Project" });
    const skillB = (
      await dbQuery(
        'SELECT us.id FROM "UserSkill" us JOIN "Project" p ON p."userId" = us."userId" WHERE p.id = $1',
        [projectB],
      )
    ).rows[0]!.id as string;
    await page.context().clearCookies();

    await newUser(page, "PfIntruderA");
    await page.goto(`/dashboard/portfolio/projects/${projectB}`);
    await expect(visible(page, "Project not found")).toBeVisible();
    await expect(visible(page, "B Private Project")).toHaveCount(0);
    await page.goto(`/dashboard/skill-passport/${skillB}`);
    await expect(visible(page, "Skill not found")).toBeVisible();
  });

  test("25. rejects a tampered project id", async ({ page }) => {
    await newUser(page, "PfTamperB");
    const projectB = await createProject(page, { title: "B Untouchable" });
    await page.context().clearCookies();

    await newUser(page, "PfTamperA");
    const projectA = await createProject(page, { title: "A Own Project" });
    await tamper(page, "**/dashboard/portfolio/projects/*", projectA, projectB);
    await byId(page, "title").fill("Hijacked");
    await button(page, "Save project").click();
    await expect(visible(page, PROJECT_NOT_FOUND)).toBeVisible();
    const rows = await dbQuery('SELECT title FROM "Project" WHERE id IN ($1, $2) ORDER BY title', [
      projectA,
      projectB,
    ]);
    expect(rows.rows.map((r) => r.title)).toEqual(["A Own Project", "B Untouchable"]);
  });

  test("26. rejects tampered portfolio item and owner ids", async ({ page }) => {
    const userB = await newUser(page, "PfPortB");
    await saveProfile(page, { headline: "B headline" });
    await addSection(page, "certification", { name: "B Cert", issuer: "B Org" });
    await page.context().clearCookies();
    const certB = (
      await dbQuery(
        'SELECT id FROM "Certification" WHERE name = $1 ORDER BY "createdAt" DESC LIMIT 1',
        ["B Cert"],
      )
    ).rows[0]!.id as string;
    const idB = (await dbQuery('SELECT id FROM "User" WHERE email = $1', [userB.email])).rows[0]!
      .id as string;

    const userA = await newUser(page, "PfPortA");
    await addSection(page, "certification", { name: "A Cert", issuer: "A Org" });
    const certA = (
      await dbQuery(
        'SELECT c.id FROM "Certification" c JOIN "User" u ON u.id = c."userId" WHERE u.email = $1',
        [userA.email],
      )
    ).rows[0]!.id as string;

    await tamper(page, "**/dashboard/portfolio/edit", certA, certB);
    await page
      .getByRole("button", { name: "Make public: A Cert" })
      .filter({ visible: true })
      .click();
    await expect(visible(page, NOT_FOUND).first()).toBeVisible();
    expect(
      (await dbQuery('SELECT visibility FROM "Certification" WHERE id = $1', [certB])).rows[0]!
        .visibility,
    ).toBe("PRIVATE");

    // A browser-supplied owner id is ignored: only the session user's profile changes.
    await page.unrouteAll({ behavior: "wait" });
    await tamper(
      page,
      "**/dashboard/portfolio/edit",
      '[{"headline"',
      `[{"userId":"${idB}","headline"`,
    );
    await saveProfile(page, { headline: "A headline" });
    const headlines = await dbQuery(
      'SELECT u.email, p.headline FROM "Profile" p JOIN "User" u ON u.id = p."userId" WHERE u.email IN ($1, $2)',
      [userA.email, userB.email],
    );
    const byEmail = Object.fromEntries(headlines.rows.map((r) => [r.email, r.headline]));
    expect(byEmail[userA.email]).toBe("A headline");
    expect(byEmail[userB.email]).toBe("B headline");
  });

  test("27. rate-limits AI generations (10 per hour)", async ({ page }) => {
    test.setTimeout(150_000);
    await newUser(page, "PfRateLimit");
    await addSkill(page, "Python");
    await page.goto("/dashboard/portfolio/edit");
    const bioButton = button(page, /bio/i);
    for (let i = 0; i < 10; i++) {
      const done = page.waitForResponse(
        (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
      );
      await bioButton.click();
      await done;
      await expect(bioButton).toBeEnabled();
    }
    await expect(byId(page, "bio")).toHaveValue("I work with Python.");
    await bioButton.click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: /reached the limit/ })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    // Other features keep working.
    await button(page, "Save profile").click();
    await expect(visible(page, "Profile saved")).toBeVisible();
  });

  test("28. sends a single request for a double-clicked AI generation", async ({ page }) => {
    await newUser(page, "PfDuplicate");
    await addSkill(page, "Python");
    await page.goto("/dashboard/portfolio/edit");
    let actions = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.headers()["next-action"]) actions++;
    });
    await button(page, "Generate headline with AI").dblclick();
    await expect(byId(page, "headline")).toHaveValue("Python");
    await page.waitForTimeout(500);
    expect(actions).toBe(1);
  });
});

async function layoutCheck(browser: Browser, theme: "dark" | "light", width: number, name: string) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  await context.addInitScript((t) => window.localStorage.setItem("theme", t), theme);
  const page = await context.newPage();
  const { username } = await publicPortfolio(page, name);
  for (const path of [
    "/dashboard/portfolio",
    "/dashboard/portfolio/edit",
    "/dashboard/portfolio/projects",
    "/dashboard/portfolio/projects/new",
    "/dashboard/portfolio/skills",
    "/dashboard/portfolio/settings",
    "/dashboard/skill-passport",
    `/p/${username}`,
    `/p/${username}/skills`,
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
    expect(await hasHorizontalOverflow(page), `${path} overflows at ${width}px`).toBe(false);
  }
  await context.close();
}

test.describe("Portfolio layout", () => {
  test("29. works on mobile (360px)", async ({ browser }) => {
    test.setTimeout(150_000);
    await layoutCheck(browser, "dark", 360, "PfMobile");
  });

  test("30. works in the dark theme", async ({ browser }) => {
    test.setTimeout(150_000);
    await layoutCheck(browser, "dark", 1280, "PfDark");
  });

  test("31. works in the light theme", async ({ browser }) => {
    test.setTimeout(150_000);
    await layoutCheck(browser, "light", 390, "PfLight");
  });

  test("32. public pages are responsive", async ({ browser }) => {
    test.setTimeout(150_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    const { username } = await publicPortfolio(page, "PfResponsive");
    await context.clearCookies(); // view as an anonymous visitor
    for (const width of [360, 375, 390, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        `/p/${username}`,
        `/p/${username}/skills`,
        `/p/${username}/projects/public-churn-dashboard`,
      ]) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        expect(await hasHorizontalOverflow(page), `${path} overflows at ${width}px`).toBe(false);
      }
    }
    await context.close();
  });
});
