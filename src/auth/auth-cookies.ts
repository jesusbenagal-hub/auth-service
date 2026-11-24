import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply } from "fastify";

import { ACCESS_TOKEN_TTL_SECONDS } from "./access-token.service.js";
import { REFRESH_TOKEN_TTL_SECONDS } from "./refresh-token.service.js";

/** The cookie with the access JWT; the hub's proxy turns it into a Bearer header. */
export const ACCESS_TOKEN_COOKIE = "hub_at";

/** The cookie with the refresh token; only auth-service ever reads it. */
export const REFRESH_TOKEN_COOKIE = "hub_rt";

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

/** Sets the refresh token cookie, only for the auth endpoints. */
export function setRefreshTokenCookie(
  reply: FastifyReply,
  refreshToken: string,
): void {
  reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions,
    // Only /api/auth/refresh and /api/auth/logout need it: the other APIs
    // never see it, so a bug or a log there can't leak it.
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}
