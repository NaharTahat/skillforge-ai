import { expect, test } from "@playwright/test";
import { login, makeUser, register, signOut } from "./helpers";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/cv",
  "/dashboard/job-match",
  "/dashboard/roadmap",
  "/dashboard/interview",
  "/dashboard/assessments",
  "/dashboard/portfolio",
  "/dashboard/passport",
  "/dashboard/settings",
  "/dashboard/profile",
];

test.describe("unauthenticated access", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects ${route} to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?callbackUrl=${encodeURIComponent(route)}$`),
      );
    });
  }

  test("protected API returns 401 without a session", async ({ request }) => {
    const response = await request.get("/api/me");
    expect(response.status()).toBe(401);
  });

  test("landing page shows sign-in and get-started links", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    await expect(header.getByRole("link", { name: "Get started" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});

test.describe("registration", () => {
  test("creates an account and lands on the dashboard with sample-data indicators", async ({
    page,
  }) => {
    const user = makeUser("Ada");
    await register(page, user);
    await expect(page.getByRole("heading", { name: "Welcome back, Ada" })).toBeVisible();
    await expect(page.getByText("Sample data.")).toBeVisible();
    await expect(page.getByText(/Preview/).first()).toBeVisible();
  });

  test("validates on the client: weak password and mismatch", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("First name").fill("Weak");
    await page.getByLabel("Last name").fill("Password");
    await page.getByLabel("Email").fill("weak@example.test");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Password needs:/)).toBeVisible();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("rejects an email that is already registered", async ({ page, browser }) => {
    const user = makeUser("Dup");
    await register(page, user);

    const other = await browser.newContext();
    const page2 = await other.newPage();
    await page2.goto("/register");
    await page2.getByLabel("First name").fill("Second");
    await page2.getByLabel("Last name").fill("Person");
    await page2.getByLabel("Email").fill(user.email.toUpperCase());
    await page2.getByLabel("Password", { exact: true }).fill(user.password);
    await page2.getByLabel("Confirm password").fill(user.password);
    await page2.getByRole("button", { name: "Create account" }).click();
    await expect(page2.getByText(/already exists/)).toBeVisible();
    await other.close();
  });
});

test.describe("login and logout", () => {
  test("logs in, redirects away from auth pages, logs out, and loses access", async ({ page }) => {
    const user = makeUser("Grace");
    await register(page, user);
    await signOut(page);

    await login(page, user.email, user.password);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Signed-in users are sent away from /login and /register.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/register");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Landing page reflects the session.
    await page.goto("/");
    await expect(
      page.locator("header").first().getByRole("link", { name: "Go to dashboard" }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await signOut(page);
    await page.goto("/dashboard/profile");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });

  test("shows a generic error for invalid credentials", async ({ page }) => {
    const user = makeUser("Wrong");
    await register(page, user);
    await signOut(page);

    await login(page, user.email, "Not-The-Password1");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Unknown email yields the identical message (no account enumeration).
    await login(page, `nobody-${Date.now()}@example.test`, "Whatever-123");
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });

  test("returns to the originally requested page after login", async ({ page }) => {
    const user = makeUser("Cb");
    await register(page, user);
    await signOut(page);

    await page.goto("/dashboard/profile");
    await expect(page).toHaveURL(/callbackUrl=%2Fdashboard%2Fprofile/);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/profile$/);
  });
});

test.describe("profile", () => {
  test("shows real data, saves edits and updates completion", async ({ page }) => {
    const user = makeUser("Linus");
    await register(page, user);

    await page.goto("/dashboard/profile");
    await expect(page.getByLabel("First name")).toHaveValue("Linus");
    await expect(page.getByLabel("Email")).toHaveValue(user.email);
    // Registration fills first, last and display name: 3 of 8.
    await expect(page.getByText("3 of 8 details added")).toBeVisible();

    await page.getByLabel("Career goal").click();
    await page.getByRole("option", { name: "Machine Learning Engineer" }).click();
    await page.getByLabel("Current experience level").click();
    await page.getByRole("option", { name: "Fresh Graduate" }).click();
    await page.getByLabel("Location").fill("Amman, Jordan");
    await page.getByLabel("Bio").fill("Building production ML systems.");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Profile saved").first()).toBeVisible();
    await expect(page.getByText("7 of 8 details added")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Location")).toHaveValue("Amman, Jordan");
    await expect(page.getByLabel("Career goal")).toContainText("Machine Learning Engineer");
    // The only field still missing is the image.
    await expect(page.getByRole("listitem").filter({ hasText: /^Profile image$/ })).toBeVisible();
  });

  test("requires the current password to change email", async ({ page }) => {
    const user = makeUser("Mail");
    await register(page, user);
    await page.goto("/dashboard/profile");

    await page.getByLabel("Email").fill(`changed-${user.email}`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Enter your current password to change your email.")).toBeVisible();

    await page.getByLabel("Current password").fill("Wrong-Password1");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Incorrect password.")).toBeVisible();

    await page.getByLabel("Current password").fill(user.password);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile saved").first()).toBeVisible();
  });
});

test.describe("user data isolation", () => {
  test("each user only ever sees their own account", async ({ browser }) => {
    const alice = makeUser("Alice");
    const bob = makeUser("Bob");

    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    const bobPage = await bobContext.newPage();
    await register(alicePage, alice);
    await register(bobPage, bob);

    const me = async (page: typeof alicePage, query = "") => {
      const response = await page.request.get(`/api/me${query}`);
      expect(response.status(), await response.text()).toBe(200);
      return response.json();
    };

    const aliceMe = await me(alicePage);
    const bobMe = await me(bobPage);
    expect(aliceMe.email).toBe(alice.email);
    expect(bobMe.email).toBe(bob.email);
    expect(aliceMe).not.toHaveProperty("passwordHash");

    // A user id supplied by the browser is ignored; identity comes from the session.
    const spoofed = await me(alicePage, `?userId=${bobMe.id}`);
    expect(spoofed.id).toBe(aliceMe.id);

    // Bob's profile page contains Bob's data and nothing of Alice's.
    await bobPage.goto("/dashboard/profile");
    await expect(bobPage.getByLabel("Email")).toHaveValue(bob.email);
    await expect(bobPage.locator("body")).not.toContainText(alice.email);

    // Alice saving her profile does not touch Bob's.
    await alicePage.goto("/dashboard/profile");
    await alicePage.getByLabel("Location").fill("Alice City");
    await alicePage.getByRole("button", { name: "Save changes" }).click();
    await expect(alicePage.getByText("Profile saved").first()).toBeVisible();
    await bobPage.reload();
    await expect(bobPage.getByLabel("Location")).toHaveValue("");

    await aliceContext.close();
    await bobContext.close();
  });
});
