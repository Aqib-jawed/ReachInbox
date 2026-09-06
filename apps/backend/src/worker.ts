import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { createEmailWorker } from "./queues/workers/email.worker";
import { prisma } from "./config/db";
import { redisConnection } from "./config/redis";
import logger from "./lib/logger";

logger.info("Starting ReachInbox Standalone Background Email Worker Process...");

const worker = createEmailWorker();

let isShuttingDown = false;

const handleShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, `Received ${signal}, draining worker...`);

  // Hard timeout: 25 seconds safety ceiling
  const forceExitTimer = setTimeout(() => {
    logger.warn("Shutdown timeout of 25s exceeded. Forcing exit now.");
    process.exit(1);
  }, 25000);
  forceExitTimer.unref();

  try {
    // 1. Stop accepting new jobs and wait for active jobs to finish
    await worker.close();
    logger.info("BullMQ Worker drained successfully.");

    // 2. Disconnect Redis connection
    try {
      await redisConnection.quit();
      logger.info("Redis connection closed.");
    } catch (redisErr) {
      logger.warn({ redisErr }, "Redis disconnect warning");
    }

    // 3. Disconnect Prisma
    try {
      await prisma.$disconnect();
      logger.info("Prisma DB connection closed.");
    } catch (dbErr) {
      logger.warn({ dbErr }, "Prisma disconnect warning");
    }

    logger.info("Worker process graceful shutdown complete. Exiting.");
    process.exit(0);
  } catch (err: any) {
    logger.error({ err }, "Error during worker graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
