import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";
import { JwksController } from "./jwks.controller.js";
import { SigningKeyService } from "./signing-key.service.js";

@Module({
  controllers: [AuthController, JwksController],
  providers: [GoogleTokenVerifier, AuthService, SigningKeyService],
})
export class AuthModule {}
