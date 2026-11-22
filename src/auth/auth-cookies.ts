import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply } from "fastify";

import { ACCESS_TOKEN_TTL_SECONDS } from "./access-token.service.js";

/** The cookie with the access JWT; the hub's proxy turns it into a Bearer header. */
export const ACCESS_TOKEN_COOKIE = "hub_at";

// Common to every auth cookie.
const baseCookieOptions = {
  // Not readable from JavaScript: an XSS in the hub can't steal the token.
  httpOnly: true,
  // Only over HTTPS (browsers treat http://localhost as secure too).
  secure: true,
  // Not sent on requests started by other sites: no CSRF.
  sameSite: "strict",
} satisfies CookieSerializeOptions;

/** Sets the access token cookie, which expires when the token does. */
export function setAccessTokenCookie(
  reply: FastifyReply,
  accessToken: string,
): void {
  reply.setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    // A path as the browser sees it: every API is behind /api on the hub's
    // origin (/api/<app>/*), and only those requests need the token.
    path: "/api",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });
}
