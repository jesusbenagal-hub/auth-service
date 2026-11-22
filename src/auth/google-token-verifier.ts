import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import type { Env } from "../config/env.js";

/** Who Google says signed in, once the id_token is verified. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  isEmailVerified: boolean;
  name: string | undefined;
  picture: string | undefined;
}

// Google's public keys. jose downloads them on first use, caches them and
// fetches again only when a token is signed with a key id (kid) it doesn't know.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

// The claims we use from the id_token, checked at runtime: a valid signature
// says Google wrote it, not that it has the shape we expect.
const googleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean(),
  name: z.string().optional(),
  picture: z.url().optional(),
});

@Injectable()
export class GoogleTokenVerifier {
  private readonly clientId: string;

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get("GOOGLE_CLIENT_ID", { infer: true });
  }

  /** Verifies the id_token from Google Identity Services, or throws 401. */
  async verify(idToken: string): Promise<GoogleIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        // Signed by Google…
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        // …for our OAuth client (a token for another app is rejected)…
        audience: this.clientId,
        // …with the algorithm Google uses; `exp` and `iat` are always checked.
        algorithms: ["RS256"],
      });
      const claims = googleClaimsSchema.parse(payload);

      return {
        sub: claims.sub,
        email: claims.email,
        isEmailVerified: claims.email_verified,
        name: claims.name,
        picture: claims.picture,
      };
    } catch {
      // The reason (expired, wrong audience, bad signature…) is for us, not
      // for whoever sent the token.
      throw new UnauthorizedException("Invalid Google credential");
    }
  }
}
