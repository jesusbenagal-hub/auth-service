import { Module } from "@nestjs/common";

import { TokensModule } from "../tokens/tokens.module.js";
import { MeController } from "./me.controller.js";
import { UsersService } from "./users.service.js";

@Module({
  // A guard in @UseGuards gets its dependencies from the module of the
  // controller that uses it: MeController's AccessTokenGuard needs
  // SigningKeyService, so this module needs TokensModule.
  imports: [TokensModule],
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
