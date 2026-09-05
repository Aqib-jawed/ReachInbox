import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma } from "../config/db";
import { notifyRateLimitBreach } from "../integrations/slack/notifier";
import app from "../server";
import http from "http";

async function runSlackTests() {
  console.log("💬 Starting Phase 5 Slack Integration Acceptance Tests...\n");

  let testServer: http.Server | null = null;
  let baseUrl = "http://localhost:4000";

  // Check if server is running on 4000, else start ephemeral server on 4005
  try {
    const health = await fetch("http://localhost:4000/health");
    if (health.ok) {
      baseUrl = "http://localhost:4000";
    }
  } catch {
    testServer = app.listen(4005);
    baseUrl = "http://localhost:4005";
  }

  const testUser = await prisma.user.create({
    data: {
      googleId: `slack_user_${Date.now()}`,
      email: `slack_${Date.now()}@example.com`,
      name: "Slack Tester",
    },
  });

  try {
    // 1. Test Disconnected State (must no-op silently with no errors/crashes)
    console.log("1. Testing disconnected state notification...");
    const disconnectedResult = await notifyRateLimitBreach(testUser.id, {
      senderEmail: "outbox_demo@reachinbox.ai",
      currentCount: 51,
      maxPerHour: 50,
      rescheduledTo: new Date(Date.now() + 3600000),
    });
    console.log(`✅ Disconnected call completed safely without error (Result: ${disconnectedResult})`);

    // 2. Query status via API endpoint (Expected: connected = false)
    console.log("\n2. Checking Slack status via GET /api/slack/status...");
    const statusRes1 = await fetch(`${baseUrl}/api/slack/status?userId=${testUser.id}`);
    const statusJson1: any = await statusRes1.json();
    console.log("✅ Initial status:", statusJson1);
    if (statusJson1.connected !== false) {
      throw new Error("❌ Expected connected=false for new user");
    }

    // 3. Connect Slack for User
    console.log("\n3. Simulating Slack OAuth connection for user...");
    const integration = await prisma.slackIntegration.create({
      data: {
        userId: testUser.id,
        teamId: "T0998877",
        teamName: "OutboxLabs Team",
        accessToken: "xoxb-simulated-token-123",
        webhookUrl: "https://httpbin.org/post", // Safe mock webhook endpoint for live HTTP test
        channel: "#alerts-email-ops",
      },
    });
    console.log(`✅ Slack Integration stored in DB for ${integration.teamName} (${integration.channel})`);

    // 4. Query status via API endpoint (Expected: connected = true)
    console.log("\n4. Checking Slack status via GET /api/slack/status after connection...");
    const statusRes2 = await fetch(`${baseUrl}/api/slack/status?userId=${testUser.id}`);
    const statusJson2: any = await statusRes2.json();
    console.log("✅ Updated status:", statusJson2);
    if (statusJson2.connected !== true || statusJson2.integration?.teamName !== "OutboxLabs Team") {
      throw new Error("❌ Expected connected=true with correct teamName");
    }

    // 5. Test Live Notification with Slack connected
    console.log("\n5. Testing live rate limit breach notification...");
    const connectedResult = await notifyRateLimitBreach(testUser.id, {
      senderEmail: "marketing@reachinbox.ai",
      currentCount: 55,
      maxPerHour: 50,
      rescheduledTo: new Date(Date.now() + 3600000),
    });
    console.log(`✅ Live notification dispatched successfully (Result: ${connectedResult})`);

    // 6. Test Disconnect via API
    console.log("\n6. Testing Disconnect via POST /api/slack/disconnect...");
    const disconnectRes = await fetch(`${baseUrl}/api/slack/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: testUser.id }),
    });
    const disconnectJson: any = await disconnectRes.json();
    console.log("✅ Disconnect response:", disconnectJson);

    const statusRes3 = await fetch(`${baseUrl}/api/slack/status?userId=${testUser.id}`);
    const statusJson3: any = await statusRes3.json();
    console.log("✅ Final status after disconnect:", statusJson3);
    if (statusJson3.connected !== false) {
      throw new Error("❌ Expected connected=false after disconnect");
    }

    // 7. Test Per-Sender Slack Webhook Field & notifySlackRateLimitHit
    console.log("\n7. Testing Per-Sender slackWebhookUrl and notifySlackRateLimitHit service...");
    const { getSlackAuthorizeUrl, notifySlackRateLimitHit } = await import("../services/slack");

    const testSender = await prisma.sender.create({
      data: {
        userId: testUser.id,
        etherealEmail: "sender_slack_test@ethereal.email",
        etherealPassword: "pass",
        slackWebhookUrl: "https://httpbin.org/post",
      },
    });

    const authUrl = getSlackAuthorizeUrl(testSender.id);
    console.log(`✅ getSlackAuthorizeUrl generated: ${authUrl}`);
    if (!authUrl.includes("scope=incoming-webhook") || !authUrl.includes(testSender.id)) {
      throw new Error("❌ Invalid authorize URL generated");
    }

    // Call notifySlackRateLimitHit with connected sender
    await notifySlackRateLimitHit(testSender, {
      hourlyLimit: 50,
      nextRunAt: new Date(Date.now() + 3600000),
    });
    console.log("✅ notifySlackRateLimitHit executed successfully on connected sender.");

    // Call notifySlackRateLimitHit on null webhook (must no-op)
    await notifySlackRateLimitHit({ slackWebhookUrl: null, email: "disconnected@example.com" }, {
      hourlyLimit: 50,
      nextRunAt: new Date(),
    });
    console.log("✅ notifySlackRateLimitHit safely no-ops on null webhookUrl.");

    // Cleanup
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log("\n✅ Cleaned up Slack test records.");
    console.log("\n🎉 ALL SLACK OAUTH & SENDER TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Slack test failed:", err);
    process.exit(1);
  } finally {
    if (testServer) {
      testServer.close();
    }
    await prisma.$disconnect();
  }
}

runSlackTests();
