import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

/** How long a login lasts without using it: each refresh starts it again. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * The hash we store instead of the token. SHA-256 and not bcrypt: the token
 * is 256 random bits, not a password, so nobody can guess it from its hash,
 * and a fast hash lets us find it by its unique index.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a refresh token for the user. A login starts a new family;
   * step 5c passes the family on when it rotates a token.
   */
  async issue(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    // Opaque: random bytes that mean nothing by themselves. What they stand
    // for (user, expiry, revocation) lives in the database.
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: hashRefreshToken(token), expiresAt },
    });

    return { token, expiresAt };
  }
}
