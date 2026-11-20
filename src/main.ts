import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
const config = app.get<ConfigService<Env, true>>(ConfigService);

// Fastify listens only on 127.0.0.1 by default; in a container (Cloud Run)
// requests come from outside, so it listens on every interface.
await app.listen({
  port: config.get("PORT", { infer: true }),
  host: "0.0.0.0",
});
