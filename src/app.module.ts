import { Module, StandardSchemaValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_PIPE } from "@nestjs/core";

import { AuthModule } from "./auth/auth.module.js";
import { envSchema } from "./config/env.js";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    // Reads .env (if there is one) and process.env, validated by envSchema.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // Validates every @Body/@Query/@Param that declares a `schema` (400 if not).
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
})
export class AppModule {}
