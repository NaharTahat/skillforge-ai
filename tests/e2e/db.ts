import { config } from "dotenv";
import pg from "pg";

/**
 * Test-only database access for states the UI can't create quickly (an expired
 * timer, a CV without an analysis). Uses the same DATABASE_URL as the server
 * under test — the dedicated E2E database when run with `npm run test:e2e:pg`.
 */
config({ path: ".env.local" }); // fallback only; never overrides an existing DATABASE_URL

export async function dbQuery(sql: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}
