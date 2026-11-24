import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createLocalJWKSet, jwtVerify } from "jose";

import { TOKEN_ISSUER } from "./access-token.service.js";
import { type HubUser, toHubUser } from "./hub-user.js";
import { SigningKeyService } from "./signing-key.service.js";

// Teaches TypeScript that a request can carry the user the guard verified.
declare module "fastify" {
  interface FastifyRequest {
    user?: HubUser;
  }
}

/** The token of an `Authorization: Bearer <token>` header, if there is one. */
function getBearerToken(request: FastifyRequest): string | undefined {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

/**
 * Lets a request through only with a valid access token, and leaves its user
 * in `request.user`. The browser sends the token in the hub_at cookie; the
 * hub's proxy turns it into this header, the same for every API.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  // Our own JWKS, read in memory: auth-service doesn't need to ask itself.
  // Step 7 moves this guard to nest-auth, where the APIs fetch it by URL.
  private readonly keySet: ReturnType<typeof createLocalJWKSet>;

  constructor(signingKeyService: SigningKeyService) {
    this.keySet = createLocalJWKSet(signingKeyService.getJwks());
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = getBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    try {
      const { payload } = await jwtVerify(token, this.keySet, {
        issuer: TOKEN_ISSUER,
        algorithms: ["ES256"],
      });
      request.user = toHubUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }
}
