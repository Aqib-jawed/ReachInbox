import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { checkAndIncrementRateLimit, getCurrentHourWindow } from "../queues/limiter/rate-limiter";
import { redisClient } from "../config/redis";

describe("Rate Limiter - Redis Hourly Counter", () => {
  const testSenderId = `test-sender-${Date.now()}`;

  beforeEach(async () => {
    // Clean up test keys
    const hourWindow = getCurrentHourWindow();
    const key = `ratelimit:sender:${testSenderId}:${hourWindow}`;
    await redisClient.del(key);
  });

  afterAll(async () => {
    const hourWindow = getCurrentHourWindow();
    const key = `ratelimit:sender:${testSenderId}:${hourWindow}`;
    await redisClient.del(key);
  });

  it("allows requests below the maxPerHour limit", async () => {
    const limit = 3;

    // Send 1: allowed (count = 1)
    const res1 = await checkAndIncrementRateLimit(testSenderId, limit);
    expect(res1.allowed).toBe(true);
    expect(res1.currentCount).toBe(1);

    // Send 2: allowed (count = 2)
    const res2 = await checkAndIncrementRateLimit(testSenderId, limit);
    expect(res2.allowed).toBe(true);
    expect(res2.currentCount).toBe(2);

    // Send 3: allowed (count = 3)
    const res3 = await checkAndIncrementRateLimit(testSenderId, limit);
    expect(res3.allowed).toBe(true);
    expect(res3.currentCount).toBe(3);
  });

  it("blocks the Nth+1 request within the same hour window", async () => {
    const limit = 2;

    const res1 = await checkAndIncrementRateLimit(testSenderId, limit);
    expect(res1.allowed).toBe(true);

    const res2 = await checkAndIncrementRateLimit(testSenderId, limit);
    expect(res2.allowed).toBe(true);

    // 3rd attempt exceeds limit of 2
    const res3 = await checkAndIncrementRateLimit(testSenderId, limit);
    expect(res3.allowed).toBe(false);
    expect(res3.currentCount).toBe(3);
    expect(res3.delayToNextWindowMs).toBeGreaterThan(0);
    expect(res3.nextWindowAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("allows sends again when window resets or for a fresh sender window", async () => {
    const freshSenderId = `fresh-sender-${Date.now()}`;
    const limit = 1;

    const firstAttempt = await checkAndIncrementRateLimit(freshSenderId, limit);
    expect(firstAttempt.allowed).toBe(true);

    const secondAttempt = await checkAndIncrementRateLimit(freshSenderId, limit);
    expect(secondAttempt.allowed).toBe(false);

    // Simulate window expiry / reset by deleting key
    const hourWindow = getCurrentHourWindow();
    await redisClient.del(`ratelimit:sender:${freshSenderId}:${hourWindow}`);

    const afterResetAttempt = await checkAndIncrementRateLimit(freshSenderId, limit);
    expect(afterResetAttempt.allowed).toBe(true);
    expect(afterResetAttempt.currentCount).toBe(1);

    // Cleanup
    await redisClient.del(`ratelimit:sender:${freshSenderId}:${hourWindow}`);
  });
});
