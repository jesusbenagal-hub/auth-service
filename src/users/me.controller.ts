import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { AccessTokenGuard } from "../common/guards/access-token.guard.js";
import type { HubUser } from "../common/types/hub-user.js";
import { type SignedInUser, UsersService } from "./users.service.js";

/**
 * Who is signed in. The hub calls it when it loads: its JavaScript can't read
 * the httpOnly cookies, so it asks. Fresh from the database, with the photo.
 */
@Controller("me")
@UseGuards(AccessTokenGuard)
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: HubUser): Promise<SignedInUser> {
    return this.usersService.getSignedInUser(user.id);
  }
}
