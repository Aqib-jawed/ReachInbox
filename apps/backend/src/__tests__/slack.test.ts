import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifySlackRateLimitHit } from "../services/slack";

describe("Slack Service - notifySlackRateLimitHit", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("does not throw when slackWebhookUrl is null or undefined", async () => {
    await expect(
      notifySlackRateLimitHit(
        { slackWebhookUrl: null, etherealEmail: "sender@ethereal.email" },
        { hourlyLimit: 50, nextRunAt: new Date(Date.now() + 3600000) }
      )
    ).resolves.not.toThrow();

    await expect(
      notifySlackRateLimitHit(
        { slackWebhookUrl: undefined, etherealEmail: "sender@ethereal.email" },
        { hourlyLimit: 50, nextRunAt: new Date(Date.now() + 3600000) }
      )
    ).resolves.not.toThrow();
  });

  it("does not throw and handles gracefully when fetch rejects (network error)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection reset"));

    await expect(
      notifySlackRateLimitHit(
        { slackWebhookUrl: "https://hooks.slack.com/services/TEST/MOCK/123", etherealEmail: "sender@ethereal.email" },
        { hourlyLimit: 50, nextRunAt: new Date(Date.now() + 3600000) }
      )
    ).resolves.not.toThrow();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("sends formatted webhook payload when webhookUrl is provided and fetch succeeds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    const nextRun = new Date("2026-12-01T12:00:00.000Z");

    await notifySlackRateLimitHit(
      { slackWebhookUrl: "https://hooks.slack.com/services/VALID/WEBHOOK/123", etherealEmail: "sales@ethereal.email" },
      { hourlyLimit: 25, nextRunAt: nextRun }
    );

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/VALID/WEBHOOK/123",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("sales@ethereal.email"),
      })
    );
  });
});
