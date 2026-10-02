import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; load it first so the Prisma CLI sees the same values.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // Optional; empty string means "let Prisma create a temporary shadow DB".
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] || undefined,
  },
});
