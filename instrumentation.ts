/**
 * Runs once when the server starts. Validates the environment so a missing or
 * unsafe production setting stops the server with a clear message (variable
 * names and rules only — never values) instead of failing on first use.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { parseServerEnv } = await import("./lib/env-schema");
  const env = parseServerEnv(process.env);
  if (env.NODE_ENV === "production" && env.AI_PROVIDER === "mock") {
    console.warn(
      "[config] AI_PROVIDER=mock: results are deterministic stand-ins, not AI analysis.",
    );
  }
}
