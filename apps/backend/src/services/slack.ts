import logger from "../lib/logger";

/**
 * Builds the Slack OAuth 2.0 authorization URL with incoming-webhook scope.
 * @param senderId The Sender ID passed in state to identify which sender row to update.
 */
export function getSlackAuthorizeUrl(senderId: string): string {
  const clientId = process.env.SLACK_CLIENT_ID || "";
  const redirectUri =
    process.env.SLACK_REDIRECT_URI || "http://localhost:4000/api/slack/oauth/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "incoming-webhook",
    redirect_uri: redirectUri,
    state: senderId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchanges a Slack temporary authorization code for incoming webhook and team details.
 * @param code Authorization code from Slack callback
 */
export async function exchangeSlackCode(
  code: string
): Promise<{ webhookUrl: string; channel: string; teamName: string }> {
  const clientId = process.env.SLACK_CLIENT_ID || "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET || "";
  const redirectUri =
    process.env.SLACK_REDIRECT_URI || "http://localhost:4000/api/slack/oauth/callback";

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams.toString(),
  });

  const data: any = await res.json();

  if (!data.ok) {
    logger.error({ data }, "Slack OAuth exchange returned error");
    throw new Error(`Slack OAuth error: ${data.error || "Unknown exchange error"}`);
  }

  const webhookUrl = data.incoming_webhook?.url;
  const channel = data.incoming_webhook?.channel || "general";
  const teamName = data.team?.name || "Slack Workspace";

  if (!webhookUrl) {
    throw new Error("Slack OAuth response missing incoming_webhook.url");
  }

  return {
    webhookUrl,
    channel,
    teamName,
  };
}

/**
 * Posts a rate-limit breach alert to the sender's Slack webhook.
 * Never throws or rejects to ensure zero impact on worker stability.
 */
export async function notifySlackRateLimitHit(
  sender: { slackWebhookUrl?: string | null; email?: string; etherealEmail?: string },
  details: { hourlyLimit: number; nextRunAt: Date }
): Promise<void> {
  const webhookUrl = sender.slackWebhookUrl;
  if (!webhookUrl) {
    // No-op if no webhook is connected
    return;
  }

  const senderEmail = sender.email || sender.etherealEmail || "Sender";
  const formattedDate = details.nextRunAt.toISOString();

  const message = `⚠️ Sender *${senderEmail}* hit its hourly limit of *${details.hourlyLimit}*. Remaining emails in this batch have been rescheduled to *${formattedDate}*.`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
      }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, senderEmail }, "Slack webhook returned non-200 response");
    } else {
      logger.info({ senderEmail }, "Slack rate-limit breach notification delivered successfully");
    }
  } catch (err: any) {
    logger.error({ err: err?.message, senderEmail }, "Failed to deliver Slack notification");
  }
}
