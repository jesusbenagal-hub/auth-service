import { ForbiddenException, Injectable } from "@nestjs/common";

import { AccessTokenService } from "../tokens/access-token.service.js";
import { RefreshTokenService } from "../tokens/refresh-token.service.js";
import { type SignedInUser, UsersService } from "../users/users.service.js";
import {
  type GoogleIdentity,
  GoogleTokenVerifier,
} from "./google-token-verifier.js";

/** A signed-in browser: the user and the two tokens that go in its cookies. */
export interface Session {
  user: SignedInUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * The session flow: logging in with Google, refreshing and logging out.
 * AuthController only moves its results in and out of the cookies.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly googleTokenVerifier: GoogleTokenVerifier,
    private readonly usersService: UsersService,
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** Verifies the id_token from Google and starts a new session. */
  async loginWithGoogle(credential: string): Promise<Session> {
    const identity = await this.googleTokenVerifier.verify(credential);
    const user = await this.signInWithGoogle(identity);

    const accessToken = await this.accessTokenService.issue(user);
    const refreshToken = await this.refreshTokenService.issue(user.id);
    return { user, accessToken, refreshToken: refreshToken.token };
  }

  /**
   * Swaps a refresh token for a new pair of tokens. The roles are read
   * again, so a change since the login reaches the new access token.
   */
  async refresh(token: string): Promise<Session> {
    const { userId, refreshToken } =
      await this.refreshTokenService.rotate(token);
    const user = await this.usersService.getSignedInUser(userId);

    const accessToken = await this.accessTokenService.issue(user);
    return { user, accessToken, refreshToken: refreshToken.token };
  }

  /** Ends the session the refresh token belongs to. */
  async logout(token: string): Promise<void> {
    await this.refreshTokenService.revoke(token);
  }

  /**
   * Signs in someone Google has already verified. Only registered users get
   * in (the hub is private): they are found by their Google `sub` or, on their
   * first login, by email, and that first login links the Google account.
   */
  private async signInWithGoogle(
    identity: GoogleIdentity,
  ): Promise<SignedInUser> {
    // An unverified email doesn't prove whose it is: never link by it.
    if (!identity.isEmailVerified) {
      throw new ForbiddenException("Email not verified by Google");
    }

    const profile = { name: identity.name, avatarUrl: identity.picture };

    const linkedUser = await this.usersService.findByGoogleSub(identity.sub);
    if (linkedUser) {
      // Name and photo may have changed in Google since the last login.
      return this.usersService.updateProfile(linkedUser.id, profile);
    }

    const registeredUser = await this.usersService.findByEmail(identity.email);
    // Not registered (`undefined !== null`), or the email belongs to a user
    // already linked to another Google account.
    if (registeredUser?.googleSub !== null) {
      throw new ForbiddenException("Not registered in the hub");
    }

    // First login: link the Google account to the user registered by email.
    return this.usersService.linkGoogleAccount(
      registeredUser.id,
      identity.sub,
      profile,
    );
  }
}
