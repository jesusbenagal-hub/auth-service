import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";

@Module({
  controllers: [AuthController],
  providers: [GoogleTokenVerifier, AuthService],
})
export class AuthModule {}
