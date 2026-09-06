import { describe, it, expect } from "vitest";
import {
  getEffectiveHourlyLimit,
  getWarmupStatus,
} from "../services/warmup";

describe("Sender Warm-up - Effective Limit Calculations", () => {
  const baseSender = {
    id: "sender-1",
    etherealEmail: "test@ethereal.email",
    rateLimitConfig: { maxPerHour: 200 },
  };

  it("returns configured hourlyLimit unchanged when warm-up is disabled", () => {
    const sender = {
      ...baseSender,
      warmupEnabled: false,
      warmupStartedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    const limit = getEffectiveHourlyLimit(sender, 200);
    expect(limit).toBe(200);
  });

  it("returns configured hourlyLimit unchanged when warmupStartedAt is null", () => {
    const sender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: null,
    };

    const limit = getEffectiveHourlyLimit(sender, 200);
    expect(limit).toBe(200);
  });

  it("returns day-1 step limit on Day 0 (first 24 hours of warm-up)", () => {
    const startDate = new Date("2026-09-06T10:00:00.000Z");
    const sender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: startDate,
    };

    // Current time is 2 hours after start (Day 0)
    const now = new Date("2026-09-06T12:00:00.000Z");
    const limit = getEffectiveHourlyLimit(sender, 200, now);

    // Day 1 step limit is 20
    expect(limit).toBe(20);
  });

  it("returns day-3 step limit on the exact boundary of day 3", () => {
    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const sender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: startDate,
    };

    // Exactly 3 days later
    const day3 = new Date("2026-09-04T00:00:00.000Z");
    const limit = getEffectiveHourlyLimit(sender, 200, day3);

    // Day 3 step is 50/hr
    expect(limit).toBe(50);
  });

  it("returns day-7 step limit on day 7 and day 10", () => {
    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const sender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: startDate,
    };

    const day7 = new Date("2026-09-08T00:00:00.000Z");
    expect(getEffectiveHourlyLimit(sender, 200, day7)).toBe(100);

    const day10 = new Date("2026-09-11T00:00:00.000Z");
    expect(getEffectiveHourlyLimit(sender, 200, day10)).toBe(100);
  });

  it("returns last step limit clamped to ceiling for days far beyond the plan (e.g. Day 30)", () => {
    const startDate = new Date("2026-08-01T00:00:00.000Z");
    const sender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: startDate,
    };

    const day30 = new Date("2026-08-31T00:00:00.000Z");
    // Last step is 200/hr, ceiling is 200/hr
    expect(getEffectiveHourlyLimit(sender, 200, day30)).toBe(200);
  });

  it("strictly clamps down if a plan step limit exceeds the sender's ceiling limit", () => {
    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const lowCeilingSender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: startDate,
      rateLimitConfig: { maxPerHour: 30 }, // Hard ceiling: 30/hr
    };

    // Day 14 step in plan is 200/hr, but ceiling is 30/hr
    const day15 = new Date("2026-09-16T00:00:00.000Z");
    const limit = getEffectiveHourlyLimit(lowCeilingSender, 30, day15);

    // Must be clamped down to 30
    expect(limit).toBe(30);
  });

  it("provides correct status telemetry with upcoming step calculation", () => {
    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const sender = {
      ...baseSender,
      warmupEnabled: true,
      warmupStartedAt: startDate,
    };

    const day4 = new Date("2026-09-05T00:00:00.000Z");
    const status = getWarmupStatus(sender, 200, day4);

    expect(status.enabled).toBe(true);
    expect(status.daysSinceStart).toBe(4);
    expect(status.currentEffectiveLimit).toBe(50);
    expect(status.nextStepDay).toBe(7);
    expect(status.nextStepLimit).toBe(100);
    expect(status.ceilingLimit).toBe(200);
  });
});
