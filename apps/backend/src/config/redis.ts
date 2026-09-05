import Redis, { RedisOptions } from "ioredis";
import pino from "pino";

const logger = pino({
  name: "redis-client",
  level: process.env.LOG_LEVEL || "info",
});

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
};

// Dedicated connection for general Redis operations (rate limiter, cache, health checks)
export const redisClient = new Redis(redisUrl, redisOptions);

redisClient.on("connect", () => {
  logger.info("Connected to Redis");
});

redisClient.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

// Helper for BullMQ which needs separate connections
export function createRedisConnection(): Redis {
  return new Redis(redisUrl, redisOptions);
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const ping = await redisClient.ping();
    return ping === "PONG";
  } catch (err) {
    logger.error({ err }, "Redis health check failed");
    return false;
  }
}
