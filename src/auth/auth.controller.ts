import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { z } from "zod";

import { AccessTokenService } from "./access-token.service.js";
import { AuthService } from "./auth.service.js";
import { GoogleTokenVerifier } from "./google-token-verifier.js";

// What Google Identity Services gives the browser: `credential` is the id_token.
const googleLoginSchema = z.object({ credential: z.string().min(1) });

type GoogleLoginBody = z.infer<typeof googleLoginSchema>;

export interface LoginResponse {
  accessToken: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly googleTokenVerifier: GoogleTokenVerifier,
    private readonly authService: AuthService,
    private readonly accessTokenService: AccessTokenService,
  ) {}

  // TODO(phase-2): step 5 sends the tokens as httpOnly cookies.
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body({ schema: googleLoginSchema }) body: GoogleLoginBody,
  ): Promise<LoginResponse> {
    const identity = await this.googleTokenVerifier.verify(body.credential);
    const user = await this.authService.signInWithGoogle(identity);
    return { accessToken: await this.accessTokenService.issue(user) };
  }
}
