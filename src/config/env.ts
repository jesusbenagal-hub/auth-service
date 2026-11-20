import { z } from "zod";

/**
 * Environment variables the service needs. Nest validates them at startup
 * (ConfigModule), so a missing or malformed one stops the process with a clear
 * error instead of failing on the first request.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  // Neon, pooled (PgBouncer, host with -pooler): the app's queries.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Neon, direct: the Prisma CLI (migrations).
  DATABASE_URL_UNPOOLED: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;
