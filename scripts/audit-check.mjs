#!/usr/bin/env node
/**
 * Dependency audit gate for runtime dependencies.
 * Fails on any high/critical advisory that isn't in audit-allowlist.json,
 * and on allowlist entries whose review date has passed.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowlist = JSON.parse(
  readFileSync(new URL("../audit-allowlist.json", import.meta.url), "utf8"),
).advisories;
const today = new Date().toISOString().slice(0, 10);

let report;
try {
  // A constant command (no user input); a string so it also works with npm.cmd on Windows.
  report = execSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch (error) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  report = error.stdout;
}
const vulnerabilities = JSON.parse(report).vulnerabilities ?? {};

const found = new Map();
for (const [pkg, v] of Object.entries(vulnerabilities)) {
  for (const via of v.via) {
    if (typeof via === "string") continue;
    const id = via.url?.split("/").pop();
    if (id && !found.has(id)) found.set(id, { pkg, severity: via.severity, title: via.title });
  }
}

const failures = [];
for (const [id, a] of found) {
  const entry = allowlist.find((e) => e.id === id);
  if (!entry) {
    if (a.severity === "high" || a.severity === "critical")
      failures.push(`${id} (${a.pkg}, ${a.severity}): ${a.title}`);
    else console.log(`note: ${id} (${a.pkg}, ${a.severity}) — below the gate`);
  } else if (entry.reviewBy < today) {
    failures.push(
      `${id} (${a.pkg}): allowlist entry expired on ${entry.reviewBy}; review it again`,
    );
  } else {
    console.log(`allowed until ${entry.reviewBy}: ${id} (${a.pkg}, ${a.severity})`);
  }
}
for (const entry of allowlist) {
  if (!found.has(entry.id))
    console.log(`resolved: ${entry.id} no longer reported — remove it from the allowlist`);
}

if (failures.length) {
  console.error("\nDependency audit failed:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\nDependency audit passed.");
