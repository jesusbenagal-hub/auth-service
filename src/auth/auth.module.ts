import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";

@Module({
  controllers: [AuthController],
  providers: [GoogleTokenVerifier],
})
export class AuthModule {}
