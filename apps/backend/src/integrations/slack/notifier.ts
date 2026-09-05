import { prisma } from "../../config/db";
import pino from "pino";

const logger = pino({
  name: "slack-notifier",
  level: process.env.LOG_LEVEL || "info",
});

export interface SlackNotificationPayload {
  text: string;
  blocks?: any[];
}

export interface RateLimitBreachDetails {
  senderEmail: string;
  currentCount: number;
  maxPerHour: number;
  rescheduledTo: Date;
}

/**
 * Sends a notification to the user's connected Slack workspace/channel.
 * If no integration exists, silently no-ops without throwing or interrupting the worker flow.
 */
export async function notifySlack(userId: string, payload: SlackNotificationPayload): Promise<boolean> {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    const webhookUrl = integration?.webhookUrl || process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl || webhookUrl.includes("placeholder") || webhookUrl.includes("00000000")) {
      logger.debug({ userId }, "No active Slack integration or valid webhook found. Skipping Slack alert silently.");
      return false;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn({ status: response.status, errorText }, "Slack webhook returned non-200 status");
      return false;
    }

    logger.info({ userId }, "Successfully posted notification to Slack");
    return true;
  } catch (err: any) {
    logger.warn({ err: err.message, userId }, "Slack notification failed (non-blocking)");
    return false;
  }
}

/**
 * Sends a structured alert when a sender hits the hourly rate limit.
 */
export async function notifyRateLimitBreach(
  userId: string,
  details: RateLimitBreachDetails
): Promise<boolean> {
  const payload: SlackNotificationPayload = {
    text: `⚠️ *Rate Limit Exceeded* for sender \`${details.senderEmail}\` (${details.currentCount}/${details.maxPerHour} emails this hour). Rescheduling to next window: ${details.rescheduledTo.toISOString()}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "⚠️ ReachInbox Alert: Rate Limit Exceeded",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Sender:*\n${details.senderEmail}`,
          },
          {
            type: "mrkdwn",
            text: `*Hourly Limit:*\n${details.maxPerHour} emails/hr`,
          },
          {
            type: "mrkdwn",
            text: `*Current Burst:*\n${details.currentCount} emails`,
          },
          {
            type: "mrkdwn",
            text: `*Next Window:*\n${details.rescheduledTo.toUTCString()}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "ℹ️ _Jobs are automatically deferred to the next hourly window without data loss or duplicate delivery._",
          },
        ],
      },
    ],
  };

  return notifySlack(userId, payload);
}
