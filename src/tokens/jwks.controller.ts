import { Controller, Get, Header } from "@nestjs/common";

import { type Jwks, SigningKeyService } from "./signing-key.service.js";

/**
 * The public keys of auth-service, at the standard path. The APIs fetch them
 * once and cache them, so verifying a token never needs a call to us.
 */
@Controller(".well-known")
export class JwksController {
  constructor(private readonly signingKeyService: SigningKeyService) {}

  @Get("jwks.json")
  @Header("Cache-Control", "public, max-age=300")
  getJwks(): Jwks {
    return this.signingKeyService.getJwks();
  }
}
