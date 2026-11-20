import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);

// Fastify listens only on 127.0.0.1 by default; in a container (Cloud Run)
// requests come from outside, so it listens on every interface.
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
