import { randomUUID } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { createLocalJWKSet, type JSONWebKeySet, jwtVerify } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../src/auth/auth-cookies.js";
import type { GoogleIdentity } from "../src/auth/google-token-verifier.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TOKEN_ISSUER,
} from "../src/tokens/access-token.service.js";
import {
  hashRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../src/tokens/refresh-token.service.js";
import { createTestApp } from "./create-test-app.js";

describe("POST /auth/google (e2e)", () => {
  describe("with the real Google verifier", () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it("answers 400 without a credential", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("answers 401 when the credential isn't a Google id_token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { credential: "not-a-jwt" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        message: "Invalid Google credential",
      });
    });
  });

  describe("signing in registered users", () => {
    // Unique per run, so the test never collides with real data.
    const runId = randomUUID();
    const appId = `e2e-${runId}`;
    const registeredEmail = `registered-${runId}@example.com`;
    const linkedEmail = `linked-${runId}@example.com`;
    const unverifiedEmail = `unverified-${runId}@example.com`;

    // The fake verifier: each credential is the identity Google would return.
    const identities = new Map<string, GoogleIdentity>([
      [
        "registered",
        {
          sub: `sub-registered-${runId}`,
          email: registeredEmail,
          isEmailVerified: true,
          name: "Registered Person",
          picture: undefined,
        },
      ],
      [
        "stranger",
        {
          sub: `sub-stranger-${runId}`,
          email: `stranger-${runId}@example.com`,
          isEmailVerified: true,
          name: undefined,
          picture: undefined,
        },
      ],
      [
        "unverified",
        {
          sub: `sub-unverified-${runId}`,
          email: unverifiedEmail,
          isEmailVerified: false,
          name: undefined,
          picture: undefined,
        },
      ],
      [
        "other-google-account",
        {
          sub: `sub-other-${runId}`,
          email: linkedEmail,
          isEmailVerified: true,
          name: undefined,
          picture: undefined,
        },
      ],
    ]);
    const fakeVerifier = {
      verify: (credential: string): Promise<GoogleIdentity> => {
        const identity = identities.get(credential);
        return identity
          ? Promise.resolve(identity)
          : Promise.reject(new UnauthorizedException());
      },
    };

    let app: NestFastifyApplication;
    let prisma: PrismaService;

    function signIn(credential: string) {
      return app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { credential },
      });
    }

    beforeAll(async () => {
      app = await createTestApp(fakeVerifier);
      prisma = app.get(PrismaService);

      await prisma.app.create({ data: { id: appId, name: "E2E" } });
      await prisma.user.create({
        data: {
          email: registeredEmail,
          appRoles: { create: { appId, role: "editor" } },
        },
      });
      await prisma.user.create({
        data: { email: linkedEmail, googleSub: `sub-linked-${runId}` },
      });
      await prisma.user.create({ data: { email: unverifiedEmail } });
    });

    afterAll(async () => {
      // Deleting the users and the app also deletes their roles (cascade).
      await prisma.user.deleteMany({
        where: {
          email: { in: [registeredEmail, linkedEmail, unverifiedEmail] },
        },
      });
      await prisma.app.delete({ where: { id: appId } });
      await app.close();
    });

    // Verifies the access token like an API will: with our published JWKS.
    async function verifyAccessToken(accessToken: string) {
      const jwksResponse = await app.inject({
        method: "GET",
        url: "/.well-known/jwks.json",
      });
      const jwks = createLocalJWKSet(jwksResponse.json<JSONWebKeySet>());
      return jwtVerify(accessToken, jwks, {
        issuer: TOKEN_ISSUER,
        algorithms: ["ES256"],
      });
    }

    it("links the Google account on the first login", async () => {
      const response = await signIn("registered");

      expect(response.statusCode).toBe(200);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: registeredEmail },
      });
      expect(user.googleSub).toBe(`sub-registered-${runId}`);
    });

    it("answers with the user", async () => {
      const response = await signIn("registered");

      expect(response.json()).toMatchObject({
        email: registeredEmail,
        name: "Registered Person",
        isHubAdmin: false,
        apps: { [appId]: "editor" },
      });
    });

    it("sets the access token in an httpOnly cookie for /api", async () => {
      const response = await signIn("registered");

      const cookie = response.cookies.find(
        ({ name }) => name === ACCESS_TOKEN_COOKIE,
      );
      expect(cookie).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/api",
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
      });
      // The token never travels in the body, where JavaScript could read it.
      expect(response.body).not.toContain(cookie?.value);
    });

    it("sets the refresh token in an httpOnly cookie for /api/auth", async () => {
      const response = await signIn("registered");

      const cookie = response.cookies.find(
        ({ name }) => name === REFRESH_TOKEN_COOKIE,
      );
      expect(cookie).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "Strict",
        path: "/api/auth",
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      });
    });

    it("stores only a hash of the refresh token", async () => {
      const response = await signIn("registered");
      const token =
        response.cookies.find(({ name }) => name === REFRESH_TOKEN_COOKIE)
          ?.value ?? "";

      const byToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: token },
      });
      const byHash = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(token) },
        include: { user: true },
      });
      expect(byToken).toBeNull();
      expect(byHash).toMatchObject({
        revokedAt: null,
        user: { email: registeredEmail },
      });
    });

    it("signs the access token with our key", async () => {
      const response = await signIn("registered");
      const cookie = response.cookies.find(
        ({ name }) => name === ACCESS_TOKEN_COOKIE,
      );

      const { payload, protectedHeader } = await verifyAccessToken(
        cookie?.value ?? "",
      );

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: registeredEmail },
      });
      expect(protectedHeader).toMatchObject({ alg: "ES256", typ: "JWT" });
      expect(payload).toMatchObject({
        iss: TOKEN_ISSUER,
        sub: user.id,
        email: registeredEmail,
        name: "Registered Person",
        hub_admin: false,
        apps: { [appId]: "editor" },
      });
      expect(payload.exp).toBe((payload.iat ?? 0) + ACCESS_TOKEN_TTL_SECONDS);
    });
  });
});
