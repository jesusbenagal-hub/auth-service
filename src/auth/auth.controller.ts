import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AccessTokenService } from "./access-token.service.js";
import {
  REFRESH_TOKEN_COOKIE,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "./auth-cookies.js";
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

  /**
   * Swaps the refresh token cookie for a new pair of tokens. The browser
   * calls it when an API answers 401 because the access token expired.
   */
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignedInUser> {
    const token = request.cookies[REFRESH_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const { userId, refreshToken } =
      await this.refreshTokenService.rotate(token);
    const user = await this.authService.getSignedInUser(userId);

    setAccessTokenCookie(reply, await this.accessTokenService.issue(user));
    setRefreshTokenCookie(reply, refreshToken.token);
    return user;
  }
}
