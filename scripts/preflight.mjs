#!/usr/bin/env node
/**
 * Production preflight — READ-ONLY. Run it against the target environment
 * (e.g. `railway run npm run preflight`) before every release that touches the
 * database. It never writes anything and never prints secrets.
 *
 *   1. Validates the environment with the app's own production rules.
 *   2. Prints the target database identity (host, port, database, user; no password).
 *   3. Refuses development / E2E databases and local hosts.
 *   4. Reports TLS on the connection.
 *   5. Lists pending migrations (to review their SQL before `npm run db:migrate:deploy`).
 *
 * Exit code 0 = safe to continue, 1 = stop and read the messages.
 * `--allow-local` lets you dry-run it against a local database.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const allowLocal = process.argv.includes("--allow-local");
const problems = [];
const say = (line = "") => console.log(line);

// 1. Environment (same rules the server applies at startup).
let env;
try {
  const { parseServerEnv } = await import("../lib/env-schema.ts");
  env = parseServerEnv({ ...process.env, NODE_ENV: "production" });
  say("✔ environment: valid for production");
} catch (error) {
  problems.push(String(error.message ?? error));
  say("✘ environment: invalid (see below)");
}

// 2–3. Database identity.
const raw = process.env.DATABASE_URL;
if (!raw) {
  problems.push("DATABASE_URL is not set");
} else {
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const host = url.hostname;
  say(
    `  database: ${database} on ${host}:${url.port || "5432"} as ${decodeURIComponent(url.username)}`,
  );
  say(`  sslmode: ${url.searchParams.get("sslmode") ?? "(not set)"}`);
  if (["skillforge", "skillforge_e2e"].includes(database)) {
    problems.push(
      `"${database}" is a development/E2E database name; production must use its own database`,
    );
  }
  if (["localhost", "127.0.0.1", "::1"].includes(host) && !allowLocal) {
    problems.push(`${host} is a local host; production must point at the production database`);
  }

  // 4–5. Connect read-only.
  const client = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    const {
      rows: [info],
    } = await client.query(
      "SELECT current_database() AS db, current_user AS usr, (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl, current_setting('server_version') AS version",
    );
    say(
      `✔ connected: ${info.db} as ${info.usr}, PostgreSQL ${info.version}, TLS ${info.ssl ? "on" : "OFF"}`,
    );
    if (!info.ssl) {
      say("  ! TLS is off. Fine on a private network (e.g. Railway's internal network);");
      say("    over the public internet add sslmode=require (or verify-full) to DATABASE_URL.");
    }
    const {
      rows: [{ superuser }],
    } = await client.query(
      "SELECT rolsuper AS superuser FROM pg_roles WHERE rolname = current_user",
    );
    if (superuser)
      say(
        "  ! connected as a superuser; prefer a least-privilege role for the app (see DEPLOYMENT.md)",
      );

    const local = readdirSync(path.resolve("prisma/migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    let applied = [];
    try {
      const { rows } = await client.query(
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
      );
      applied = rows.map((r) => r.migration_name);
    } catch {
      say("  (no _prisma_migrations table yet: this is an empty database)");
    }
    const unknown = applied.filter((m) => !local.includes(m));
    if (unknown.length)
      problems.push(`database has migrations this release doesn't know: ${unknown.join(", ")}`);
    const pending = local.filter((m) => !applied.includes(m));
    say(`✔ migrations: ${applied.length} applied, ${pending.length} pending`);
    for (const name of pending) {
      const sql = readFileSync(path.resolve("prisma/migrations", name, "migration.sql"), "utf8");
      const destructive =
        /\b(DROP\s+(TABLE|COLUMN|TYPE|INDEX)|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN\s+\S+\s+TYPE)\b/i.test(
          sql,
        );
      say(
        `  - ${name}${destructive ? "  ⚠ contains potentially destructive statements: review before applying" : ""}`,
      );
    }
  } catch (error) {
    problems.push(`could not connect to the database (${error.code ?? error.name})`);
  } finally {
    await client.end().catch(() => {});
  }
}

if (env && env.AI_PROVIDER === "mock")
  say("  ! AI_PROVIDER=mock: users would get deterministic stand-ins, not AI analysis");
if (env && env.MAIL_TRANSPORT !== "resend")
  say("  ! no email transport: password reset is unavailable");

say();
if (problems.length) {
  say("STOP:");
  for (const p of problems) say(`  - ${p}`);
  process.exit(1);
}
say("Preflight passed. Back up the database before applying pending migrations.");
