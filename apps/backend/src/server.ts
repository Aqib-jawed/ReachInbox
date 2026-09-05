import path from "path";
import dotenv from "dotenv";

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pino from "pino";
import pinoHttp from "pino-http";
import { checkDbHealth } from "./config/db";
import { checkRedisHealth } from "./config/redis";
import { checkElasticsearchHealth } from "./config/elasticsearch";
import { bullBoardRouter } from "./admin/bull-board";
import { requireAuth } from "./middleware/auth.middleware";
import authRoutes from "./routes/auth.routes";
import emailRoutes from "./routes/email.routes";
import senderRoutes from "./routes/sender.routes";
import slackRoutes from "./routes/slack.routes";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});

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
app.use("/api/slack", slackRoutes); // OAuth callbacks are public; actions check session

// Health check endpoint
app.get("/health", async (_req: Request, res: Response) => {
  const isDbHealthy = await checkDbHealth();
  const isRedisHealthy = await checkRedisHealth();
  const isEsHealthy = await checkElasticsearchHealth();
  const isHealthy = isDbHealthy && isRedisHealthy;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    db: isDbHealthy,
    redis: isRedisHealthy,
    elasticsearch: isEsHealthy,
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

// Structured error handling middleware (AGENTS.md Section 5)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled server error");
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected error occurred",
    },
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Bull Board queue dashboard available at http://localhost:${PORT}/admin/queues`);
});

// Graceful shutdown
const handleShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

export default app;
