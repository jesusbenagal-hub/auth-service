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

import type { SignedInUser } from "../users/users.service.js";
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from "./auth-cookies.js";
import { AuthService } from "./auth.service.js";

// What Google Identity Services gives the browser: `credential` is the id_token.
const googleLoginSchema = z.object({ credential: z.string().min(1) });

type GoogleLoginBody = z.infer<typeof googleLoginSchema>;

/**
 * The HTTP side of the session: what comes in the body and the cookies, and
 * what goes back in them. The flow itself is AuthService's.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Signs in with Google: the tokens go in cookies, the user in the body. */
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body({ schema: googleLoginSchema }) body: GoogleLoginBody,
    // passthrough: we only add cookies; Nest still sends what we return.
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignedInUser> {
    const session = await this.authService.loginWithGoogle(body.credential);
    setAuthCookies(reply, session);
    return session.user;
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

    const session = await this.authService.refresh(token);
    setAuthCookies(reply, session);
    return session.user;
  }

  /**
   * Logs out: revokes the login's refresh tokens and deletes both cookies.
   * Always 204, even without a cookie: the browser ends up logged out anyway.
   */
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies[REFRESH_TOKEN_COOKIE];
    if (token) {
      await this.authService.logout(token);
    }
    clearAuthCookies(reply);
  }
}
