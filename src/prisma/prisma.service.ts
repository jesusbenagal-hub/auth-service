import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaNeon } from "@prisma/adapter-neon";

import type { Env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * The Prisma client as a Nest provider: one instance (and one connection
 * pool) for the whole service, closed when the app shuts down.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    // Neon's driver over the pooled connection (PgBouncer, host with -pooler).
    const adapter = new PrismaNeon({
      connectionString: config.get("DATABASE_URL", { infer: true }),
    });
    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
