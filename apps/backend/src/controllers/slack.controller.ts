import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { getSlackAuthorizeUrl, exchangeSlackCode } from "../services/slack";
import pino from "pino";

const logger = pino({
  name: "slack-controller",
  level: process.env.LOG_LEVEL || "info",
});

function getFrontendUrl(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

/**
 * GET /api/slack/oauth/start?senderId=<id>
 * Validates senderId exists in DB, then redirects (302) to Slack OAuth authorization URL.
 */
export async function handleSlackOAuthStart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const senderId = String(req.query.senderId || req.query.userId || "").trim();

    if (!senderId) {
      res.status(400).json({
        error: { code: "MISSING_SENDER_ID", message: "senderId is required to start Slack OAuth" },
      });
      return;
    }

    // Validate sender exists in DB
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      res.status(404).json({
        error: { code: "SENDER_NOT_FOUND", message: `Sender with id ${senderId} not found` },
      });
      return;
    }

    const authUrl = getSlackAuthorizeUrl(sender.id);
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/slack/oauth/callback?code=<code>&state=<senderId>
 * Exchanges Slack code, updates Sender.slackWebhookUrl, and redirects back to frontend.
 */
export async function handleSlackOAuthCallback(req: Request, res: Response): Promise<void> {
  const frontendUrl = getFrontendUrl();
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    logger.warn({ error, code: !!code, state: !!state }, "Slack OAuth callback missing code or state");
    res.redirect(`${frontendUrl}/dashboard?slack=error`);
    return;
  }

  const senderId = String(state);

  try {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      logger.error({ senderId }, "Sender not found in Slack OAuth callback");
      res.redirect(`${frontendUrl}/dashboard?slack=error`);
      return;
    }

    const exchangeResult = await exchangeSlackCode(String(code));

    // Update Sender row with the new webhook URL
    await prisma.sender.update({
      where: { id: senderId },
      data: {
        slackWebhookUrl: exchangeResult.webhookUrl,
      },
    });

    // Also update SlackIntegration for user-level record if user exists
    if (sender.userId) {
      await prisma.slackIntegration.upsert({
        where: { userId: sender.userId },
        update: {
          webhookUrl: exchangeResult.webhookUrl,
          channel: exchangeResult.channel,
          teamName: exchangeResult.teamName,
          connectedAt: new Date(),
        },
        create: {
          userId: sender.userId,
          webhookUrl: exchangeResult.webhookUrl,
          channel: exchangeResult.channel,
          teamName: exchangeResult.teamName,
        },
      });
    }

    logger.info({ senderId, channel: exchangeResult.channel, teamName: exchangeResult.teamName }, "Slack connected successfully");
    res.redirect(`${frontendUrl}/dashboard?slack=connected&team=${encodeURIComponent(exchangeResult.teamName)}`);
  } catch (err: any) {
    logger.error({ err: err?.message, senderId }, "Failed in Slack OAuth callback");
    res.redirect(`${frontendUrl}/dashboard?slack=error`);
  }
}

/**
 * GET /api/slack/status/:senderId
 * Returns { connected: boolean } based on sender's slackWebhookUrl.
 */
export async function handleGetSlackStatusBySender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetId = req.params.senderId || String(req.query.senderId || req.query.userId || "");

    if (!targetId) {
      res.status(400).json({
        error: { code: "MISSING_ID", message: "senderId or userId is required" },
      });
      return;
    }

    // Lookup by senderId or userId
    let sender = await prisma.sender.findUnique({
      where: { id: targetId },
    });

    if (!sender) {
      sender = await prisma.sender.findFirst({
        where: { userId: targetId },
      });
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: sender?.userId || targetId },
    });

    const connected = !!(sender?.slackWebhookUrl || integration?.webhookUrl);

    res.status(200).json({
      connected,
      slackWebhookUrl: sender?.slackWebhookUrl || integration?.webhookUrl || null,
      integration: integration
        ? {
            teamName: integration.teamName,
            channel: integration.channel,
            connectedAt: integration.connectedAt,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/slack/disconnect/:senderId
 * Sets slackWebhookUrl = null on the Sender row.
 */
export async function handleDisconnectSlackBySender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const senderId = req.params.senderId || req.body?.senderId || req.body?.userId;

    if (!senderId) {
      res.status(400).json({
        error: { code: "MISSING_SENDER_ID", message: "senderId is required" },
      });
      return;
    }

    // Try finding by sender ID
    let sender = await prisma.sender.findUnique({
      where: { id: String(senderId) },
    });

    if (sender) {
      await prisma.sender.update({
        where: { id: sender.id },
        data: { slackWebhookUrl: null },
      });
      if (sender.userId) {
        await prisma.slackIntegration.deleteMany({
          where: { userId: sender.userId },
        });
      }
    } else {
      // If user ID was passed
      await prisma.sender.updateMany({
        where: { userId: String(senderId) },
        data: { slackWebhookUrl: null },
      });
      await prisma.slackIntegration.deleteMany({
        where: { userId: String(senderId) },
      });
    }

    logger.info({ senderId }, "Slack disconnected successfully");
    res.status(200).json({
      success: true,
      message: "Slack disconnected successfully",
    });
  } catch (err) {
    next(err);
  }
}
