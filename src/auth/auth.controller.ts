import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { z } from "zod";

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
  ) {}

  // TODO(phase-2): step 4 answers with our JWT instead of the user.
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body({ schema: googleLoginSchema }) body: GoogleLoginBody,
  ): Promise<SignedInUser> {
    const identity = await this.googleTokenVerifier.verify(body.credential);
    return this.authService.signInWithGoogle(identity);
  }
}
