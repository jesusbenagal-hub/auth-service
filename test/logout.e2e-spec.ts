import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../src/auth/auth-cookies.js";
import { RefreshTokenService } from "../src/auth/refresh-token.service.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { createTestApp } from "./create-test-app.js";

describe("POST /auth/logout (e2e)", () => {
  const email = `logout-${randomUUID()}@example.com`;

  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({ data: { email } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  function logOut(token?: string) {
    return app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: token === undefined ? {} : { [REFRESH_TOKEN_COOKIE]: token },
    });
  }

  it("ends the login: its refresh tokens stop working", async () => {
    const firstToken = (await app.get(RefreshTokenService).issue(userId)).token;
    // A rotation first, so the family has more than one token.
    const refreshed = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { [REFRESH_TOKEN_COOKIE]: firstToken },
    });
    const secondToken =
      refreshed.cookies.find(({ name }) => name === REFRESH_TOKEN_COOKIE)
        ?.value ?? "";

    const response = await logOut(secondToken);

    expect(response.statusCode).toBe(204);
    const afterLogout = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: { [REFRESH_TOKEN_COOKIE]: secondToken },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it("deletes both cookies, each on its own path", async () => {
    const response = await logOut();

    expect(response.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: ACCESS_TOKEN_COOKIE,
          value: "",
          path: "/api",
          maxAge: 0,
        }),
        expect.objectContaining({
          name: REFRESH_TOKEN_COOKIE,
          value: "",
          path: "/api/auth",
          maxAge: 0,
        }),
      ]),
    );
  });

  it("answers 204 without a cookie or with an unknown one", async () => {
    expect((await logOut()).statusCode).toBe(204);
    expect((await logOut("made-up-token")).statusCode).toBe(204);
  });
});
