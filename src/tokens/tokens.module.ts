import { Module } from "@nestjs/common";

import { AccessTokenService } from "./access-token.service.js";
import { JwksController } from "./jwks.controller.js";
import { RefreshTokenService } from "./refresh-token.service.js";
import { SigningKeyService } from "./signing-key.service.js";

/**
 * Our tokens: the signing key and its JWKS, the access JWTs and the refresh
 * tokens. Exported, because logging in issues them and AccessTokenGuard
 * verifies them with our key wherever it is used.
 */
@Module({
  controllers: [JwksController],
  providers: [SigningKeyService, AccessTokenService, RefreshTokenService],
  exports: [SigningKeyService, AccessTokenService, RefreshTokenService],
})
export class TokensModule {}
