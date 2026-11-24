import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { GoogleTokenVerifier } from "../src/auth/google-token-verifier.js";
import { configureApp } from "../src/configure-app.js";

/**
 * The whole app, configured like main.ts, ready for `app.inject`. Optionally
 * with a fake Google verifier, so tests don't need real Google tokens.
 */
export async function createTestApp(
  googleTokenVerifier?: Pick<GoogleTokenVerifier, "verify">,
): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (googleTokenVerifier) {
    builder.overrideProvider(GoogleTokenVerifier).useValue(googleTokenVerifier);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
