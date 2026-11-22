import fastifyCookie from "@fastify/cookie";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

/**
 * What the app needs on top of its modules: Fastify plugins and shutdown
 * hooks. main.ts and the e2e tests both call it, so tests run the same app.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  // Reads the Cookie header into request.cookies and adds reply.setCookie.
  await app.register(fastifyCookie);

  // On SIGTERM (Cloud Run stopping an instance, Ctrl+C) Nest runs the
  // onModuleDestroy hooks, so PrismaService closes its connections.
  app.enableShutdownHooks();
}
