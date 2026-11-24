import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { importJWK } from "jose";

import type { Env, PrivateJwk } from "../config/env.js";

/** The public half of our signing key, as published in the JWKS. */
export interface PublicJwk {
  kty: "EC";
  crv: "P-256";
  alg: "ES256";
  use: "sig";
  kid: string;
  x: string;
  y: string;
}

/** A JSON Web Key Set: the format every verifier (jose included) reads. */
export interface Jwks {
  keys: PublicJwk[];
}

/** What signing needs: the private key and its id, for the token header. */
export interface SigningKey {
  kid: string;
  privateKey: CryptoKey;
}

@Injectable()
export class SigningKeyService {
  private readonly privateJwk: PrivateJwk;
  // Imported once, on first use, and shared by every later signature.
  private signingKey: Promise<SigningKey> | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.privateJwk = config.get("JWT_PRIVATE_KEY", { infer: true });
  }

  /** The keys anyone may use to verify our tokens. Never includes `d`. */
  getJwks(): Jwks {
    // Copied field by field: a new field in the private key can't leak.
    const { kty, crv, alg, kid, x, y } = this.privateJwk;
    return { keys: [{ kty, crv, alg, use: "sig", kid, x, y }] };
  }

  /** The private key as a CryptoKey, the form jose signs with. */
  getSigningKey(): Promise<SigningKey> {
    this.signingKey ??= importJWK(this.privateJwk, "ES256").then(
      (privateKey) => {
        // A JWK with `d` always imports as a CryptoKey; the check narrows
        // the type (importJWK can also return bytes for symmetric keys).
        if (!(privateKey instanceof CryptoKey)) {
          throw new TypeError("JWT_PRIVATE_KEY is not an asymmetric key");
        }
        return { kid: this.privateJwk.kid, privateKey };
      },
    );
    return this.signingKey;
  }
}
