import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import type { AppRole } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { GoogleIdentity } from "./google-token-verifier.js";

/** A user of the hub with their role in each app (appId → role). */
export interface SignedInUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isHubAdmin: boolean;
  apps: Record<string, AppRole>;
}

// Prisma `include`: the user's roles come in the same query.
const withAppRoles = {
  appRoles: { select: { appId: true, role: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Signs in someone Google has already verified. Only registered users get
   * in (the hub is private): they are found by their Google `sub` or, on their
   * first login, by email, and that first login links the Google account.
   */
  async signInWithGoogle(identity: GoogleIdentity): Promise<SignedInUser> {
    // An unverified email doesn't prove whose it is: never link by it.
    if (!identity.isEmailVerified) {
      throw new ForbiddenException("Email not verified by Google");
    }

    const profile = { name: identity.name, avatarUrl: identity.picture };

    const linkedUser = await this.prisma.user.findUnique({
      where: { googleSub: identity.sub },
    });
    if (linkedUser) {
      // Name and photo may have changed in Google since the last login.
      const user = await this.prisma.user.update({
        where: { id: linkedUser.id },
        data: profile,
        include: withAppRoles,
      });
      return toSignedInUser(user);
    }

    const registeredUser = await this.prisma.user.findUnique({
      where: { email: identity.email },
    });
    // Not registered (`undefined !== null`), or the email belongs to a user
    // already linked to another Google account.
    if (registeredUser?.googleSub !== null) {
      throw new ForbiddenException("Not registered in the hub");
    }

    // First login: link the Google account to the user registered by email.
    const user = await this.prisma.user.update({
      where: { id: registeredUser.id },
      data: { googleSub: identity.sub, ...profile },
      include: withAppRoles,
    });
    return toSignedInUser(user);
  }

  /**
   * The user as they are now, for a refresh: a role given or taken away
   * since the login reaches the new access token.
   */
  async getSignedInUser(userId: string): Promise<SignedInUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: withAppRoles,
    });
    // Deleted since the login (their tokens went with them, by cascade).
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    return toSignedInUser(user);
  }
}

function toSignedInUser(user: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  hubAdmin: boolean;
  appRoles: { appId: string; role: AppRole }[];
}): SignedInUser {
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
