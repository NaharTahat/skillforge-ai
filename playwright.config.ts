import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests run against a production build with a real database.
 * Prerequisites: DATABASE_URL reachable, migrations applied, `npm run build`.
 * Uses the locally installed Microsoft Edge (no browser download needed).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // Several tests register users and upload + analyze CVs end to end; 30s is too tight.
  timeout: 90_000,
  // A stuck browser call must fail the run loudly instead of blocking it indefinitely.
  globalTimeout: 45 * 60_000,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_BROWSER_CHANNEL ?? "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 60_000,
    // Every test signs up from the same IP; the production default is 10/hour.
    env: { AUTH_REGISTER_LIMIT_PER_HOUR: "1000" },
  },
});
