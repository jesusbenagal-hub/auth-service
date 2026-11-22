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
import { setAccessTokenCookie } from "./auth-cookies.js";
import { AuthService, type SignedInUser } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";

// What Google Identity Services gives the browser: `credential` is the id_token.
const googleLoginSchema = z.object({ credential: z.string().min(1) });

type GoogleLoginBody = z.infer<typeof googleLoginSchema>;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly googleTokenVerifier: GoogleTokenVerifier,
    private readonly authService: AuthService,
    private readonly accessTokenService: AccessTokenService,
  ) {}

  /** Signs in with Google: the token goes in a cookie, the user in the body. */
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body({ schema: googleLoginSchema }) body: GoogleLoginBody,
    // passthrough: we only add cookies; Nest still sends what we return.
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SignedInUser> {
    const identity = await this.googleTokenVerifier.verify(body.credential);
    const user = await this.authService.signInWithGoogle(identity);

    setAccessTokenCookie(reply, await this.accessTokenService.issue(user));
    return user;
  }
}
