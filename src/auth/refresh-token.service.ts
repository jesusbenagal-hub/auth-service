import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";

import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** How long a login lasts without using it: each refresh starts it again. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** A rotated token: whose it was and the new one that replaces it. */
export interface RotatedRefreshToken {
  userId: string;
  refreshToken: IssuedRefreshToken;
}

/**
 * The hash we store instead of the token. SHA-256 and not bcrypt: the token
 * is 256 random bits, not a password, so nobody can guess it from its hash,
 * and a fast hash lets us find it by its unique index.
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// The same answer for every failure: the reason is for us, not the caller.
function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException("Invalid refresh token");
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the first refresh token of a login: a new family. */
  async issue(userId: string): Promise<IssuedRefreshToken> {
    const { refreshToken } = await this.create(this.prisma, {
      userId,
      familyId: randomUUID(),
    });
    return refreshToken;
  }

  /**
   * Exchanges a refresh token for a new one (rotation): each token works
   * once. Using one that was already used means it was copied, so the whole
   * family (that login) is revoked and both copies stop working.
   */
  async rotate(token: string): Promise<RotatedRefreshToken> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });
    if (!current) {
      throw invalidRefreshToken();
    }
    if (current.revokedAt !== null) {
      await this.revokeFamily(current.familyId);
      throw invalidRefreshToken();
    }
    if (current.expiresAt <= new Date()) {
      throw invalidRefreshToken();
    }

    // All or nothing: the old token is never revoked without its replacement.
    const rotated = await this.prisma.$transaction(async (transaction) => {
      // Revoke it only if nobody did in the meantime: of two requests with
      // the same token, just one can win this update.
      const { count } = await transaction.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        return undefined;
      }

      const next = await this.create(transaction, {
        userId: current.userId,
        familyId: current.familyId,
      });
      await transaction.refreshToken.update({
        where: { id: current.id },
        data: { replacedById: next.id },
      });
      return next.refreshToken;
    });

    if (!rotated) {
      // The other request rotated it first: this one is a reuse.
      await this.revokeFamily(current.familyId);
      throw invalidRefreshToken();
    }
    return { userId: current.userId, refreshToken: rotated };
  }

  private async create(
    database: Prisma.TransactionClient,
    { userId, familyId }: { userId: string; familyId: string },
  ): Promise<{ id: string; refreshToken: IssuedRefreshToken }> {
    // Opaque: random bytes that mean nothing by themselves. What they stand
    // for (user, expiry, revocation) lives in the database.
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    const { id } = await database.refreshToken.create({
      data: { userId, familyId, tokenHash: hashRefreshToken(token), expiresAt },
    });
    return { id, refreshToken: { token, expiresAt } };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
