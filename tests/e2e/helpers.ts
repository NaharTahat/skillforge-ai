import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const fixture = (name: string) => path.resolve("tests/fixtures/cv", name);

export type TestUser = { firstName: string; lastName: string; email: string; password: string };

export function makeUser(firstName: string): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    firstName,
    lastName: "Tester",
    email: `e2e-${id}@example.test`,
    password: "Sk1llForge-e2e",
  };
}

export async function register(page: Page, user: TestUser) {
  await page.goto("/register");
  await page.getByLabel("First name").fill(user.firstName);
  await page.getByLabel("Last name").fill(user.lastName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  // Password hashing (scrypt) can take several seconds on a loaded machine.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function chooseFile(page: Page, name: string) {
  await page.goto("/dashboard/cv");
  // While streamed content is swapped in, React briefly keeps a hidden copy of the
  // uploader; wait for the visible one and target only it.
  await expect(page.getByText("choose a file").filter({ visible: true })).toBeVisible();
  const input = page.locator('input[type="file"]').filter({ visible: true });
  await expect(input).toHaveCount(1);
  await input.setInputFiles(fixture(name));
  await expect(page.getByText(name).filter({ visible: true })).toBeVisible();
}

/** Uploads a CV fixture and waits for the completed report. Returns the CV id. */
export async function uploadAndAnalyze(page: Page, name: string): Promise<string> {
  await chooseFile(page, name);
  await page.getByRole("button", { name: "Upload & analyze" }).click();
  await expect(page).toHaveURL(/\/dashboard\/cv\/[a-z0-9]+\?analysis=/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Overall score" })).toBeVisible({
    timeout: 30_000,
  });
  return new URL(page.url()).pathname.split("/").pop()!;
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /Account menu for/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}
