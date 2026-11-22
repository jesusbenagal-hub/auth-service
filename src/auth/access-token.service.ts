import { Injectable } from "@nestjs/common";
import { SignJWT } from "jose";

import type { SignedInUser } from "./auth.service.js";
import { SigningKeyService } from "./signing-key.service.js";

/** Who issues our tokens: every API checks `iss` against this value. */
export const TOKEN_ISSUER = "hub-auth";

/**
 * How long an access token is valid. Short, because nobody can revoke it:
 * a role change or a logout reaches the APIs when it expires.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;

@Injectable()
export class AccessTokenService {
  constructor(private readonly signingKeyService: SigningKeyService) {}

  /** Signs a JWT that says who the user is and what they can do in each app. */
  async issue(user: SignedInUser): Promise<string> {
    const { kid, privateKey } = await this.signingKeyService.getSigningKey();

    return new SignJWT({
      email: user.email,
      name: user.name,
      hub_admin: user.isHubAdmin,
      apps: user.apps,
    })
      .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
      .setIssuer(TOKEN_ISSUER)
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(privateKey);
  }
}
