import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import pino from "pino";

const logger = pino({
  name: "slack-controller",
  level: process.env.LOG_LEVEL || "info",
});

export async function handleSlackConnect(req: Request, res: Response) {
  const { userId = "default_user" } = req.query;
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI || "http://localhost:4000/api/slack/callback";

  if (!clientId || clientId.includes("placeholder")) {
    // If running in development with placeholder credentials, redirect back to frontend with a helpful flag
    logger.info("Redirecting for Slack OAuth (placeholder credentials detected)");
  }

  const scopes = "incoming-webhook,chat:write";
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId || "placeholder"}&scope=${scopes}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${state}`;

  res.redirect(authUrl);
}

export async function handleSlackCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.status(400).json({
        error: {
          code: "SLACK_OAUTH_DENIED",
          message: `Slack authorization was denied: ${error}`,
        },
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        error: {
          code: "MISSING_CODE",
          message: "No authorization code was provided by Slack",
        },
      });
      return;
    }

    let userId = "default_user";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(String(state), "base64").toString("utf-8"));
        if (decoded.userId) userId = decoded.userId;
      } catch {
        // use default
      }
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI || "http://localhost:4000/api/slack/callback";

    let webhookUrl = process.env.SLACK_WEBHOOK_URL || null;
    let teamName = "Slack Workspace";
    let teamId = "T000000";
    let channel = "#general";
    let accessToken = "xoxb-placeholder";

    // Perform live token exchange if real credentials are provided
    if (clientId && clientSecret && !clientId.includes("placeholder")) {
      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: String(code),
          redirect_uri: redirectUri,
        }),
      });

      const tokenData: any = await tokenRes.json();
      if (!tokenData.ok) {
        throw new Error(`Slack OAuth exchange failed: ${tokenData.error}`);
      }

      accessToken = tokenData.access_token;
      teamId = tokenData.team?.id || teamId;
      teamName = tokenData.team?.name || teamName;
      webhookUrl = tokenData.incoming_webhook?.url || webhookUrl;
      channel = tokenData.incoming_webhook?.channel || channel;
    }

    // Upsert into DB for this user
    const integration = await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        teamId,
        teamName,
        accessToken,
        webhookUrl,
        channel,
        connectedAt: new Date(),
      },
      create: {
        userId,
        teamId,
        teamName,
        accessToken,
        webhookUrl,
        channel,
      },
    });

    const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}?slack_connected=true&team=${encodeURIComponent(integration.teamName || "")}`);
  } catch (err) {
    next(err);
  }
}

export async function handleGetSlackStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({
        error: { code: "MISSING_USER_ID", message: "userId is required" },
      });
      return;
    }

    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: String(userId) },
    });

    res.status(200).json({
      connected: !!integration,
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

export async function handleDisconnectSlack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        error: { code: "MISSING_USER_ID", message: "userId is required" },
      });
      return;
    }

    await prisma.slackIntegration.deleteMany({
      where: { userId: String(userId) },
    });

    res.status(200).json({
      success: true,
      message: "Slack integration disconnected successfully",
    });
  } catch (err) {
    next(err);
  }
}
