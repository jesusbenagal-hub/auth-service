import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";

describe("POST /auth/google (e2e)", () => {
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
