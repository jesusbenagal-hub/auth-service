import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { decodeJwt } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../src/auth/auth-cookies.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import {
  hashRefreshToken,
  RefreshTokenService,
} from "../src/tokens/refresh-token.service.js";
import { createTestApp } from "./create-test-app.js";

describe("POST /auth/refresh (e2e)", () => {
  const runId = randomUUID();
  const appId = `e2e-${runId}`;
  const email = `refresh-${runId}@example.com`;

  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.app.create({ data: { id: appId, name: "E2E" } });
    const user = await prisma.user.create({
      data: { email, appRoles: { create: { appId, role: "reader" } } },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // The user's refresh tokens and roles go with them (cascade).
    await prisma.user.delete({ where: { id: userId } });
    await prisma.app.delete({ where: { id: appId } });
    await app.close();
  });

  /** What a Google login leaves behind: a refresh token of a new family. */
  async function logIn(): Promise<string> {
    const { token } = await app.get(RefreshTokenService).issue(userId);
    return token;
  }

  function refresh(token?: string) {
    return app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: token === undefined ? {} : { [REFRESH_TOKEN_COOKIE]: token },
    });
  }

  function cookieValue(
    response: Awaited<ReturnType<typeof refresh>>,
    name: string,
  ): string | undefined {
    return response.cookies.find((cookie) => cookie.name === name)?.value;
  }

  it("answers 401 without a refresh token cookie", async () => {
    const response = await refresh();

    expect(response.statusCode).toBe(401);
  });

  it("answers 401 to a token it never issued", async () => {
    const response = await refresh("made-up-token");

    expect(response.statusCode).toBe(401);
  });

  it("swaps the refresh token for a new pair of tokens", async () => {
    const oldToken = await logIn();

    const response = await refresh(oldToken);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ email });
    const newToken = cookieValue(response, REFRESH_TOKEN_COOKIE) ?? "";
    expect(newToken).not.toBe(oldToken);
    expect(cookieValue(response, ACCESS_TOKEN_COOKIE)).toBeDefined();

    const old = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(oldToken) },
      include: { replacedBy: true },
    });
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedBy).toMatchObject({
      tokenHash: hashRefreshToken(newToken),
      familyId: old.familyId,
      revokedAt: null,
    });
  });

  it("revokes the whole login when a used token comes back", async () => {
    const firstToken = await logIn();
    const secondToken =
      cookieValue(await refresh(firstToken), REFRESH_TOKEN_COOKIE) ?? "";

    // Someone replays the first token: it was copied.
    const replay = await refresh(firstToken);
    // From then on, neither copy works: the real user logs in again.
    const afterReplay = await refresh(secondToken);

    expect(replay.statusCode).toBe(401);
    expect(afterReplay.statusCode).toBe(401);
  });

  it("lets only one of two simultaneous refreshes through", async () => {
    const token = await logIn();

    const responses = await Promise.all([refresh(token), refresh(token)]);

    const statusCodes = responses.map(({ statusCode }) => statusCode);
    expect(statusCodes.toSorted()).toEqual([200, 401]);
  });

  it("answers 401 to an expired token", async () => {
    const token = await logIn();
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await refresh(token);

    expect(response.statusCode).toBe(401);
  });

  it("puts the user's current roles in the new access token", async () => {
    const token = await logIn();
    await prisma.userAppRole.update({
      where: { userIdAppId: { userId, appId } },
      data: { role: "editor" },
    });

    const response = await refresh(token);

    // Decoding is enough here: the signature is tested in auth.e2e-spec.ts.
    const claims = decodeJwt(cookieValue(response, ACCESS_TOKEN_COOKIE) ?? "");
    expect(claims.apps).toMatchObject({ [appId]: "editor" });
  });
});
