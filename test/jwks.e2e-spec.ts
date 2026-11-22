import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { importJWK } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";

describe("GET /.well-known/jwks.json (e2e)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("publishes one ES256 public key, cacheable for 5 minutes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/.well-known/jwks.json",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(response.json()).toMatchObject({
      keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig" }],
    });
  });

  it("never publishes the private part of the key", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/.well-known/jwks.json",
    });

    expect(response.body).not.toContain('"d"');
  });

  it("publishes a key jose can import", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/.well-known/jwks.json",
    });
    const { keys } = response.json<{ keys: [Record<string, unknown>] }>();

    await expect(importJWK(keys[0], "ES256")).resolves.toBeDefined();
  });
});
