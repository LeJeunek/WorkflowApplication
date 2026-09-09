import { PrismaClient } from "@prisma/client";

/**
 * `tsx watch` re-evaluates this module on every server file change; without
 * caching the client on `globalThis`, each reload would open a fresh pool of
 * Postgres connections on top of the ones from the previous reload,
 * eventually exhausting Neon's connection limit. Reusing a single instance
 * across reloads is the standard fix for Prisma under a dev watcher.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
