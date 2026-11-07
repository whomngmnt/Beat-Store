// Prisma client singleton (PLAN.md §6).
// In dev, Next.js re-runs this module on every hot reload. Without the
// globalThis cache, each reload would open a new connection pool until
// Postgres runs out of connections.
//
// DATABASE_URL is not checked here on purpose: `next build` loads page modules
// in CI, where there is no .env. If it's missing, the first query fails
// instead, usually with "client password must be a string".
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
