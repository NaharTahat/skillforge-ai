import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getEnv } from "@/lib/env";

function createPrismaClient() {
  const env = getEnv();
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Optional pool tuning. The local `prisma dev` server asks for a minimal idle timeout.
    ...(env.DATABASE_POOL_MAX && { max: env.DATABASE_POOL_MAX }),
    ...(env.DATABASE_IDLE_TIMEOUT_MS && { idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS }),
  });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse one client across hot reloads in development to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
