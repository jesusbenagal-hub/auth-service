import { PrismaNeon } from "@prisma/adapter-neon";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client.js";

// Run with `pnpm exec prisma db seed`. Idempotent: every write is an upsert,
// so it can run again after adding an app.

const env = z
  .object({
    DATABASE_URL: z.url(),
    // The hub admin's Google email. In .env, not in the code: the repo is public.
    SEED_ADMIN_EMAIL: z.email(),
  })
  .parse(process.env);

const apps = [
  { id: "lista-compra", name: "Lista de la compra" },
  { id: "design-system", name: "Design system" },
];

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }),
});

for (const app of apps) {
  await prisma.app.upsert({
    where: { id: app.id },
    update: { name: app.name },
    create: app,
  });
}

// Created by email: googleSub stays null until the first login with Google.
const admin = await prisma.user.upsert({
  where: { email: env.SEED_ADMIN_EMAIL },
  update: { hubAdmin: true },
  create: { email: env.SEED_ADMIN_EMAIL, hubAdmin: true },
});

for (const app of apps) {
  await prisma.userAppRole.upsert({
    where: { userIdAppId: { userId: admin.id, appId: app.id } },
    update: { role: "admin" },
    create: { userId: admin.id, appId: app.id, role: "admin" },
  });
}

console.log(`Seeded ${apps.length} apps and ${admin.email} as hub admin.`);
await prisma.$disconnect();
