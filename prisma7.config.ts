import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

// The CLI doesn't read .env by itself. In CI and Cloud Run the variables come
// from the environment and there is no file.
if (existsSync(".env")) {
  process.loadEnvFile();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations use the direct connection: PgBouncer (-pooler) doesn't keep
  // the session the schema engine relies on. Not `env()`: it throws when the
  // variable is missing, and `prisma generate` needs no database at all.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED },
});
