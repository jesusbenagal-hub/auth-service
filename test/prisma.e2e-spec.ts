import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

describe("PrismaService (e2e)", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("reaches the database through the Neon adapter", async () => {
    const prisma = moduleRef.get(PrismaService);

    const rows = await prisma.$queryRaw<
      [{ result: number }]
    >`SELECT 1 AS result`;

    expect(rows).toEqual([{ result: 1 }]);
  });
});
