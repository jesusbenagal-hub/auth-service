import { z } from "zod";

// The private key that signs our JWTs, as a JWK (scripts/generate-signing-key.ts).
const privateJwkSchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  alg: z.literal("ES256"),
  kid: z.string().min(1),
  x: z.string().min(1),
  y: z.string().min(1),
  d: z.string().min(1),
});

export type PrivateJwk = z.infer<typeof privateJwkSchema>;

function parseJson(value: string, context: z.RefinementCtx): unknown {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    context.addIssue({ code: "custom", message: "Not valid JSON" });
    return z.NEVER;
  }
}

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
  // Our OAuth client (public): the `aud` every Google id_token must carry.
  GOOGLE_CLIENT_ID: z.string().endsWith(".apps.googleusercontent.com"),
  // Text in the environment, an object once validated.
  JWT_PRIVATE_KEY: z.string().transform(parseJson).pipe(privateJwkSchema),
});

export type Env = z.infer<typeof envSchema>;
