export interface WarmupStep {
  day: number;
  hourlyLimit: number;
}

export const DEFAULT_WARMUP_PLAN: WarmupStep[] = [
  { day: 1, hourlyLimit: 20 },
  { day: 3, hourlyLimit: 50 },
  { day: 7, hourlyLimit: 100 },
  { day: 14, hourlyLimit: 200 },
];

export interface SenderWithWarmup {
  id?: string;
  warmupEnabled?: boolean | null;
  warmupStartedAt?: Date | string | null;
  warmupPlan?: any;
  rateLimitConfig?: {
    maxPerHour?: number | null;
  } | null;
}

/**
 * Parses and validates the warmup plan from JSON or returns the default plan.
 */
export function parseWarmupPlan(plan: any): WarmupStep[] {
  if (Array.isArray(plan) && plan.length > 0) {
    const valid = plan
      .filter((s) => typeof s?.day === "number" && typeof s?.hourlyLimit === "number" && s.hourlyLimit > 0)
      .map((s) => ({ day: Number(s.day), hourlyLimit: Number(s.hourlyLimit) }))
      .sort((a, b) => a.day - b.day);
    if (valid.length > 0) return valid;
  }
  return [...DEFAULT_WARMUP_PLAN];
}

/**
 * Calculates the dynamic effective hourly limit for a sender based on warm-up state and ramp curve.
 * Pure function with zero DB/Redis dependencies.
 */
export function getEffectiveHourlyLimit(
  sender: SenderWithWarmup,
  fallbackCeiling = 50,
  now: Date = new Date()
): number {
  const ceiling = sender.rateLimitConfig?.maxPerHour || fallbackCeiling;

  // Fully backward-compatible: if warmup is disabled or unstarted, return static ceiling
  if (!sender.warmupEnabled || !sender.warmupStartedAt) {
    return ceiling;
  }

  const startDate = new Date(sender.warmupStartedAt);
  if (isNaN(startDate.getTime())) {
    return ceiling;
  }

  const diffMs = now.getTime() - startDate.getTime();
  const daysSinceStart = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const plan = parseWarmupPlan(sender.warmupPlan);

  // Find the highest step whose day <= daysSinceStart
  let matchedStep: WarmupStep = { day: 1, hourlyLimit: 20 };
  if (plan.length > 0 && plan[0]) {
    matchedStep = plan[0];
  }

  for (const step of plan) {
    if (daysSinceStart >= step.day) {
      matchedStep = step;
    }
  }

  // Never exceed the sender's configured ceiling limit
  return Math.min(matchedStep.hourlyLimit, ceiling);
}

/**
 * Returns a comprehensive status DTO for frontend telemetry and Slack notifications.
 */
export function getWarmupStatus(
  sender: SenderWithWarmup,
  fallbackCeiling = 50,
  now: Date = new Date()
) {
  const ceiling = sender.rateLimitConfig?.maxPerHour || fallbackCeiling;
  const enabled = Boolean(sender.warmupEnabled && sender.warmupStartedAt);
  const plan = parseWarmupPlan(sender.warmupPlan);

  if (!enabled || !sender.warmupStartedAt) {
    return {
      enabled: false,
      startedAt: null,
      daysSinceStart: 0,
      currentEffectiveLimit: ceiling,
      plan,
      ceilingLimit: ceiling,
      nextStepDay: null,
      nextStepLimit: null,
    };
  }

  const startDate = new Date(sender.warmupStartedAt);
  const diffMs = now.getTime() - startDate.getTime();
  const daysSinceStart = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const currentEffectiveLimit = getEffectiveHourlyLimit(sender, ceiling, now);

  // Find next step in future
  const nextStep = plan.find((step) => step.day > daysSinceStart) || null;

  return {
    enabled: true,
    startedAt: startDate.toISOString(),
    daysSinceStart,
    currentEffectiveLimit,
    plan,
    ceilingLimit: ceiling,
    nextStepDay: nextStep?.day || null,
    nextStepLimit: nextStep?.hourlyLimit || null,
  };
}
