import { Module } from "@nestjs/common";

import { TokensModule } from "../tokens/tokens.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";

@Module({
  imports: [UsersModule, TokensModule],
  controllers: [AuthController],
  providers: [GoogleTokenVerifier, AuthService],
})
export class AuthModule {}
