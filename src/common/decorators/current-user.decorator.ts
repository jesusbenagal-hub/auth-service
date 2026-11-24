import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { HubUser } from "../types/hub-user.js";

/**
 * The user of a guarded route, as a parameter: `@CurrentUser() user: HubUser`.
 * Only for routes behind AccessTokenGuard, which is what puts it there.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): HubUser => {
    const { user } = context.switchToHttp().getRequest<FastifyRequest>();
    if (!user) {
      // A bug, not a client error: the route forgot @UseGuards.
      throw new Error("@CurrentUser() needs AccessTokenGuard on the route");
    }
    return user;
  },
);
