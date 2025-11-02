import { PrismaClient } from "@/lib/generated/prisma";

const createPrismaClient = () => {
  console.log("[Prisma] Initializing Prisma Client...");
  console.log("[Prisma] DATABASE_URL present:", !!process.env.DATABASE_URL);

  return new PrismaClient({
    log: ["error", "warn"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
