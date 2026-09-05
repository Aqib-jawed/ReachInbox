import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import { createEmailWorker } from "./queues/workers/email.worker";
import pino from "pino";

const logger = pino({
  name: "worker-process",
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});

logger.info("Starting ReachInbox Background Email Worker Process...");

const worker = createEmailWorker();

const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, closing worker gracefully...`);
  await worker.close();
  logger.info("Worker closed successfully.");
  process.exit(0);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
