import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { envSchema } from "./config/env.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [
    // Reads .env (if there is one) and process.env, validated by envSchema.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
