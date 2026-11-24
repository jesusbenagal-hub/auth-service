import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AccessTokenService,
  TOKEN_ISSUER,
} from "../src/auth/access-token.service.js";
import { AuthService } from "../src/auth/auth.service.js";
import { SigningKeyService } from "../src/auth/signing-key.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { createTestApp } from "./create-test-app.js";

describe("GET /me (e2e)", () => {
  const runId = randomUUID();
  const appId = `e2e-${runId}`;
  const email = `me-${runId}@example.com`;

  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.app.create({ data: { id: appId, name: "E2E" } });
    const user = await prisma.user.create({
      data: {
        email,
        name: "Me",
        appRoles: { create: { appId, role: "reader" } },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.app.delete({ where: { id: appId } });
    await app.close();
  });

  /** A valid access token for the test user, as the login would issue it. */
  async function accessToken(): Promise<string> {
    const user = await app.get(AuthService).getSignedInUser(userId);
    return app.get(AccessTokenService).issue(user);
  }

  function getMe(token?: string) {
    return app.inject({
      method: "GET",
      url: "/me",
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    });
  }

  it("answers with the signed-in user", async () => {
    const response = await getMe(await accessToken());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: userId,
      email,
      name: "Me",
      apps: { [appId]: "reader" },
    });
  });

  it("answers 401 without an access token", async () => {
    const response = await getMe();

    expect(response.statusCode).toBe(401);
  });

  it("answers 401 to a token signed with another key", async () => {
    // Same claims, but a key that isn't in our JWKS: a forged token.
    const { privateKey } = await generateKeyPair("ES256");
    const forged = await new SignJWT({ email, hub_admin: true, apps: {} })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(TOKEN_ISSUER)
      .setSubject(userId)
      .setExpirationTime("10m")
      .sign(privateKey);

    const response = await getMe(forged);

    expect(response.statusCode).toBe(401);
  });

  it("answers 401 to an expired token", async () => {
    const { kid, privateKey } = await app
      .get(SigningKeyService)
      .getSigningKey();
    const expired = await new SignJWT({
      email,
      name: "Me",
      hub_admin: false,
      apps: {},
    })
      .setProtectedHeader({ alg: "ES256", kid })
      .setIssuer(TOKEN_ISSUER)
      .setSubject(userId)
      .setIssuedAt("20 minutes ago")
      .setExpirationTime("10 minutes ago")
      .sign(privateKey);

    const response = await getMe(expired);

    expect(response.statusCode).toBe(401);
  });
});
