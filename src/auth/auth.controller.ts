import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { z } from "zod";

import {
  type GoogleIdentity,
  GoogleTokenVerifier,
} from "./google-token-verifier.js";

// What Google Identity Services gives the browser: `credential` is the id_token.
const googleLoginSchema = z.object({ credential: z.string().min(1) });

type GoogleLoginBody = z.infer<typeof googleLoginSchema>;

@Controller("auth")
export class AuthController {
  constructor(private readonly googleTokenVerifier: GoogleTokenVerifier) {}

  // TODO(phase-2): step 3b looks the user up; step 4 answers with our JWT.
  @Post("google")
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body({ schema: googleLoginSchema }) body: GoogleLoginBody,
  ): Promise<GoogleIdentity> {
    return this.googleTokenVerifier.verify(body.credential);
  }
}
