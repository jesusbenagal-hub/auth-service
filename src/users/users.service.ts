import { Injectable, UnauthorizedException } from "@nestjs/common";

import type { AppRole, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** A user of the hub with their role in each app (appId → role). */
export interface SignedInUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isHubAdmin: boolean;
  apps: Record<string, AppRole>;
}

/** Name and photo as Google has them now (`undefined` keeps what we have). */
export interface GoogleProfile {
  name: string | undefined;
  avatarUrl: string | undefined;
}

// Prisma `include`: the user's roles come in the same query.
const withAppRoles = {
  appRoles: { select: { appId: true, role: true } },
} as const;

/**
 * The only place that reads and writes the users table. It knows nothing
 * about who may sign in: that policy is AuthService's.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleSub } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Saves the name and photo Google has now (they may have changed). */
  async updateProfile(
    userId: string,
    profile: GoogleProfile,
  ): Promise<SignedInUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: profile,
      include: withAppRoles,
    });
    return toSignedInUser(user);
  }

  /** Links a Google account to the user, who from now on is found by it. */
  async linkGoogleAccount(
    userId: string,
    googleSub: string,
    profile: GoogleProfile,
  ): Promise<SignedInUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { googleSub, ...profile },
      include: withAppRoles,
    });
    return toSignedInUser(user);
  }

  /**
   * The user as they are now (for a refresh or /me): a role given or taken
   * away since the login shows up here.
   */
  async getSignedInUser(userId: string): Promise<SignedInUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: withAppRoles,
    });
    // Deleted since the login (their refresh tokens went with them).
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    return toSignedInUser(user);
  }
}

function toSignedInUser(
  user: User & { appRoles: { appId: string; role: AppRole }[] },
): SignedInUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isHubAdmin: user.hubAdmin,
    apps: Object.fromEntries(
      user.appRoles.map(({ appId, role }) => [appId, role]),
    ),
  };
}
