import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { z } from "zod";

import { AccessTokenService } from "./access-token.service.js";
import { setAccessTokenCookie, setRefreshTokenCookie } from "./auth-cookies.js";
import { AuthService, type SignedInUser } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";
import { RefreshTokenService } from "./refresh-token.service.js";

// What Google Identity Services gives the browser: `credential` is the id_token.
const googleLoginSchema = z.object({ credential: z.string().min(1) });

type GoogleLoginBody = z.infer<typeof googleLoginSchema>;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly googleTokenVerifier: GoogleTokenVerifier,
    private readonly authService: AuthService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** Signs in with Google: the tokens go in cookies, the user in the body. */
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body({ schema: googleLoginSchema }) body: GoogleLoginBody,
    // passthrough: we only add cookies; Nest still sends what we return.
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignedInUser> {
    const identity = await this.googleTokenVerifier.verify(body.credential);
    const user = await this.authService.signInWithGoogle(identity);

    const accessToken = await this.accessTokenService.issue(user);
    const refreshToken = await this.refreshTokenService.issue(user.id);

    setAccessTokenCookie(reply, accessToken);
    setRefreshTokenCookie(reply, refreshToken.token);
    return user;
  }
}
