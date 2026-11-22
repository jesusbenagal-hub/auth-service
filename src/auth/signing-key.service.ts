import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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

@Injectable()
export class SigningKeyService {
  private readonly privateJwk: PrivateJwk;

  constructor(config: ConfigService<Env, true>) {
    this.privateJwk = config.get("JWT_PRIVATE_KEY", { infer: true });
  }

  /** The keys anyone may use to verify our tokens. Never includes `d`. */
  getJwks(): Jwks {
    // Copied field by field: a new field in the private key can't leak.
    const { kty, crv, alg, kid, x, y } = this.privateJwk;
    return { keys: [{ kty, crv, alg, use: "sig", kid, x, y }] };
  }
}
