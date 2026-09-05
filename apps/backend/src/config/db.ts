import { PrismaClient } from "@prisma/client";
import pino from "pino";

const logger = pino({
  name: "db-client",
  level: process.env.LOG_LEVEL || "info",
});

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  global.__prisma = prisma;
  // @ts-ignore
  prisma.$on("query", (e: any) => {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, "Prisma Query");
  });
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return false;
  }
}
