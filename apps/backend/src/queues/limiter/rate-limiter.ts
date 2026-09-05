import { redisClient } from "../../config/redis";
import pino from "pino";

const logger = pino({
  name: "rate-limiter",
  level: process.env.LOG_LEVEL || "info",
});

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxPerHour: number;
  windowKey: string;
  nextWindowAt: Date;
  delayToNextWindowMs: number;
}

/**
 * Returns the current hour window string in UTC, e.g. "2026-09-04T19"
 */
export function getCurrentHourWindow(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${year}${month}${day}${hour}`;
}

/**
 * Calculates the start of the next hour window and delay in ms from now.
 */
export function getNextHourWindow(date = new Date()): { nextWindowAt: Date; delayMs: number } {
  const nextHour = new Date(date);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  const delayMs = Math.max(1000, nextHour.getTime() - Date.now());
  return { nextWindowAt: nextHour, delayMs };
}

/**
 * Atomically checks and increments the sender's hourly email counter in Redis.
 * Cross-worker safe via Redis atomic INCR with TTL.
 */
export async function checkAndIncrementRateLimit(
  senderId: string,
  maxPerHour: number
): Promise<RateLimitResult> {
  const now = new Date();
  const hourWindow = getCurrentHourWindow(now);
  const key = `ratelimit:sender:${senderId}:${hourWindow}`;

  // Atomic pipeline: INCR and ensure key expires after 2 hours (7200 seconds)
  const pipeline = redisClient.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 7200);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) || 1;
  const { nextWindowAt, delayMs } = getNextHourWindow(now);

  if (count > maxPerHour) {
    logger.warn(
      { senderId, hourWindow, count, maxPerHour, nextWindowAt },
      "Sender hourly rate limit exceeded. Scheduling for next window."
    );
    return {
      allowed: false,
      currentCount: count,
      maxPerHour,
      windowKey: key,
      nextWindowAt,
      delayToNextWindowMs: delayMs,
    };
  }

  logger.debug(
    { senderId, hourWindow, count, maxPerHour },
    "Sender within hourly rate limit."
  );

  return {
    allowed: true,
    currentCount: count,
    maxPerHour,
    windowKey: key,
    nextWindowAt,
    delayToNextWindowMs: delayMs,
  };
}

/**
 * Atomically decrements the sender's hourly email counter in Redis if a job is aborted before sending.
 */
export async function decrementRateLimit(senderId: string): Promise<void> {
  const now = new Date();
  const hourWindow = getCurrentHourWindow(now);
  const key = `ratelimit:sender:${senderId}:${hourWindow}`;
  try {
    await redisClient.decr(key);
  } catch (err) {
    logger.error({ err, key }, "Failed to decrement rate limit counter");
  }
}
