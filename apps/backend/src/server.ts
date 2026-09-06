import path from "path";
import dotenv from "dotenv";

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import logger from "./lib/logger";
import { prisma } from "./config/db";
import { redisConnection } from "./config/redis";
import { esClient } from "./config/elasticsearch";
import { bullBoardRouter } from "./admin/bull-board";
import { requireAuth } from "./middleware/auth.middleware";
import { createEmailWorker } from "./queues/workers/email.worker";
import authRoutes from "./routes/auth.routes";
import emailRoutes from "./routes/email.routes";
import senderRoutes from "./routes/sender.routes";
import slackRoutes from "./routes/slack.routes";
import queueRoutes from "./routes/queue.routes";

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(
  cors({
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) =>
        req.url === "/health" || (req.url ? req.url.startsWith("/admin/queues") : false),
    },
  })
);

// Admin Bull Board Dashboard
app.use("/admin/queues", bullBoardRouter);

// Public Auth Routes
app.use("/api/auth", authRoutes);

// Protected API Routes (Guarded by requireAuth)
app.use("/api/emails", requireAuth, emailRoutes);
app.use("/api/senders", requireAuth, senderRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/slack", slackRoutes); // OAuth callbacks are public; actions check session

// Helper with timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise,
  ]).catch(() => fallback);
}

// Dependency-aware Health check endpoint (Section 5)
app.get("/health", async (_req: Request, res: Response) => {
  const isEsEnabled = process.env.ELASTICSEARCH_ENABLED !== "false";

  type DepStatus = "ok" | "error";
  type EsStatus = "ok" | "error" | "disabled";

  // Check dependencies in parallel with short timeout (~1.5-2s)
  const [pgResult, redisResult, esResult] = await Promise.all([
    withTimeout<DepStatus>(
      prisma
        .$queryRaw`SELECT 1`
        .then((): DepStatus => "ok")
        .catch((): DepStatus => "error"),
      2000,
      "error"
    ),
    withTimeout<DepStatus>(
      redisConnection
        .ping()
        .then((pong: string): DepStatus => (pong === "PONG" ? "ok" : "error"))
        .catch((): DepStatus => "error"),
      2000,
      "error"
    ),
    isEsEnabled
      ? withTimeout<EsStatus>(
          esClient
            .ping()
            .then((pong: boolean): EsStatus => (pong ? "ok" : "error"))
            .catch((): EsStatus => "error"),
          2000,
          "error"
        )
      : Promise.resolve<EsStatus>("disabled"),
  ]);

  const isCriticalOk = pgResult === "ok" && redisResult === "ok";
  const overallStatus: "ok" | "degraded" = isCriticalOk && (esResult === "ok" || esResult === "disabled") ? "ok" : "degraded";

  const statusCode = isCriticalOk ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    checks: {
      postgres: pgResult,
      redis: redisResult,
      elasticsearch: esResult,
    },
    timestamp: new Date().toISOString(),
  });
});

// Structured 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found",
    },
  });
});

// Structured error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled server error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected error occurred",
    },
  });
});

// Initialize email worker inside the API server process if not standalone
const emailWorker = process.env.STANDALONE_WORKER === "true" ? null : createEmailWorker();

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Bull Board queue dashboard available at http://localhost:${PORT}/admin/queues`);
  if (emailWorker) {
    logger.info("Integrated background email worker active inside API server.");
  }
});

// Graceful shutdown (Section 1)
let isShuttingDown = false;
const handleShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, `Received ${signal}, shutting down API server gracefully...`);

  // Hard timeout: 25 seconds safety ceiling
  const forceExitTimer = setTimeout(() => {
    logger.warn("Shutdown timeout of 25s exceeded. Forcing exit now.");
    process.exit(1);
  }, 25000);
  forceExitTimer.unref();

  try {
    // 1. Close HTTP server so no new requests are accepted
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info("HTTP server closed.");
        resolve();
      });
    });

    // 2. Close integrated worker if running
    if (emailWorker) {
      logger.info("Draining integrated worker...");
      await emailWorker.close();
      logger.info("Integrated worker drained.");
    }

    // 3. Disconnect Redis
    try {
      await redisConnection.quit();
      logger.info("Redis connection closed.");
    } catch (redisErr) {
      logger.warn({ redisErr }, "Redis disconnect warning");
    }

    // 4. Disconnect Prisma
    try {
      await prisma.$disconnect();
      logger.info("Prisma DB connection closed.");
    } catch (dbErr) {
      logger.warn({ dbErr }, "Prisma disconnect warning");
    }

    logger.info("API server graceful shutdown complete. Exiting.");
    process.exit(0);
  } catch (err: any) {
    logger.error({ err }, "Error during API server shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

export default app;
