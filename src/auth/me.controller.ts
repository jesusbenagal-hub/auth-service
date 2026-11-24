import { Controller, Get, UseGuards } from "@nestjs/common";

import { AccessTokenGuard } from "./access-token.guard.js";
import { AuthService, type SignedInUser } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import type { HubUser } from "./hub-user.js";

/**
 * Who is signed in. The hub calls it when it loads: its JavaScript can't read
 * the httpOnly cookies, so it asks. Fresh from the database, with the photo.
 */
@Controller("me")
@UseGuards(AccessTokenGuard)
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getMe(@CurrentUser() user: HubUser): Promise<SignedInUser> {
    return this.authService.getSignedInUser(user.id);
  }
}
