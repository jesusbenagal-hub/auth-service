import { randomUUID } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import {
  type GoogleIdentity,
  GoogleTokenVerifier,
} from "../src/auth/google-token-verifier.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

async function createApp(
  googleTokenVerifier?: Pick<GoogleTokenVerifier, "verify">,
): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (googleTokenVerifier) {
    builder.overrideProvider(GoogleTokenVerifier).useValue(googleTokenVerifier);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe("POST /auth/google (e2e)", () => {
  describe("with the real Google verifier", () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      app = await createApp();
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
      app = await createApp(fakeVerifier);
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

    it("links the Google account on the first login", async () => {
      const response = await signIn("registered");

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        email: registeredEmail,
        name: "Registered Person",
        isHubAdmin: false,
        apps: { [appId]: "editor" },
      });
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: registeredEmail },
      });
      expect(user.googleSub).toBe(`sub-registered-${runId}`);
    });

    it("finds the user by their Google account afterwards", async () => {
      const response = await signIn("registered");

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ email: registeredEmail });
    });

    it.each([
      { label: "someone who isn't registered", credential: "stranger" },
      { label: "an unverified email", credential: "unverified" },
      {
        label: "an email linked to another Google account",
        credential: "other-google-account",
      },
    ])("answers 403 to $label", async ({ credential }) => {
      const response = await signIn(credential);

      expect(response.statusCode).toBe(403);
    });
  });
});
