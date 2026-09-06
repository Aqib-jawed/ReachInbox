import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../config/db";
import { getEffectiveHourlyLimit } from "../services/warmup";
import { checkAndIncrementRateLimit, getCurrentHourWindow } from "../queues/limiter/rate-limiter";
import { redisClient } from "../config/redis";

describe("Sender Warm-up Rate Limiting Integration", () => {
  let testUserId: string;
  let testSenderId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        googleId: `warmup-integration-${Date.now()}`,
        email: `warmup-test-${Date.now()}@example.com`,
        name: "Warmup Test User",
      },
    });
    testUserId = user.id;

    // Create a sender with 200/hr normal ceiling, but warm-up active on Day 1 (custom plan step: 2/hr)
    const sender = await prisma.sender.create({
      data: {
        userId: testUserId,
        etherealEmail: `warmup-sender-${Date.now()}@ethereal.email`,
        etherealPassword: "password123",
        warmupEnabled: true,
        warmupStartedAt: new Date(), // Day 0/1
        warmupPlan: [
          { day: 1, hourlyLimit: 2 },
          { day: 3, hourlyLimit: 5 },
          { day: 7, hourlyLimit: 10 },
        ],
        rateLimitConfig: {
          create: {
            userId: testUserId,
            maxPerHour: 200, // Normal ceiling
          },
        },
      },
      include: { rateLimitConfig: true },
    });
    testSenderId = sender.id;
  });

  afterAll(async () => {
    // Cleanup Redis and DB
    const hourWindow = getCurrentHourWindow();
    await redisClient.del(`ratelimit:sender:${testSenderId}:${hourWindow}`);
    try {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
      }
    } catch {
      // Ignore
    }
  });

  it("enforces the reduced Day-1 warm-up limit (2/hr) instead of the 200/hr ceiling", async () => {
    const sender = await prisma.sender.findUnique({
      where: { id: testSenderId },
      include: { rateLimitConfig: true },
    });

    expect(sender).toBeDefined();

    // 1. Verify getEffectiveHourlyLimit computes 2/hr for Day 0/1
    const effectiveLimit = getEffectiveHourlyLimit(sender!, 200);
    expect(effectiveLimit).toBe(2);

    // 2. Perform first 2 sends -> allowed
    const send1 = await checkAndIncrementRateLimit(testSenderId, effectiveLimit);
    expect(send1.allowed).toBe(true);

    const send2 = await checkAndIncrementRateLimit(testSenderId, effectiveLimit);
    expect(send2.allowed).toBe(true);

    // 3. 3rd send exceeds the warm-up limit of 2/hr -> blocked & rescheduled
    const send3 = await checkAndIncrementRateLimit(testSenderId, effectiveLimit);
    expect(send3.allowed).toBe(false);
    expect(send3.currentCount).toBe(3);
    expect(send3.maxPerHour).toBe(2);
    expect(send3.delayToNextWindowMs).toBeGreaterThan(0);
  });
});
