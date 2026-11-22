import { Module } from "@nestjs/common";

import { AccessTokenService } from "./access-token.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";
import { JwksController } from "./jwks.controller.js";
import { SigningKeyService } from "./signing-key.service.js";

@Module({
  controllers: [AuthController, JwksController],
  providers: [
    GoogleTokenVerifier,
    AuthService,
    SigningKeyService,
    AccessTokenService,
  ],
})
export class AuthModule {}
