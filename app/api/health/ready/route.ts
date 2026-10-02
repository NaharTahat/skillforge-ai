import { prisma } from "@/lib/db/prisma";

/**
 * Readiness probe: the app can serve requests (the database answers).
 * Used as the deploy health check so a release that can't reach its database
 * never receives traffic. Reveals nothing about configuration or errors.
 * `/api/health` stays the dependency-free liveness probe.
 */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3_000;

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
      }),
    ]);
    return Response.json({ status: "ok" }, { headers });
  } catch {
    console.error("[health] readiness check failed: database unavailable");
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  } finally {
    clearTimeout(timer);
  }
}
