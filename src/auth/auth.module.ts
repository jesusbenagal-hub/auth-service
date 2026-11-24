import { Module } from "@nestjs/common";

import { AccessTokenGuard } from "./access-token.guard.js";
import { AccessTokenService } from "./access-token.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";
import { JwksController } from "./jwks.controller.js";
import { MeController } from "./me.controller.js";
import { RefreshTokenService } from "./refresh-token.service.js";
import { SigningKeyService } from "./signing-key.service.js";

@Module({
  controllers: [AuthController, JwksController, MeController],
  providers: [
    GoogleTokenVerifier,
    AuthService,
    SigningKeyService,
    AccessTokenService,
    RefreshTokenService,
    AccessTokenGuard,
  ],
})
export class AuthModule {}
