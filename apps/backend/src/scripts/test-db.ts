import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma, checkDbHealth } from "../config/db";

async function runDbTests() {
  console.log("🚀 Starting Database Layer Verification Test...\n");

  // 1. Health check
  console.log("1. Checking DB connection health...");
  const isHealthy = await checkDbHealth();
  if (!isHealthy) {
    throw new Error("❌ DB connection health check failed!");
  }
  console.log("✅ DB connection is healthy.\n");

  const testGoogleId = `test_google_${Date.now()}`;
  const testEmail = `testuser_${Date.now()}@example.com`;

  try {
    // 2. Insert User
    console.log("2. Inserting Test User...");
    const user = await prisma.user.create({
      data: {
        googleId: testGoogleId,
        email: testEmail,
        name: "Test User",
        avatarUrl: "https://lh3.googleusercontent.com/a/test",
      },
    });
    console.log("✅ User created:", { id: user.id, email: user.email });

    // 3. Insert Sender
    console.log("\n3. Inserting Test Sender with Ethereal config...");
    const sender = await prisma.sender.create({
      data: {
        userId: user.id,
        etherealEmail: "test_sender@ethereal.email",
        etherealPassword: "test_password",
        host: "smtp.ethereal.email",
        port: 587,
      },
    });
    console.log("✅ Sender created:", { id: sender.id, email: sender.etherealEmail });

    // 4. Insert RateLimitConfig
    console.log("\n4. Inserting RateLimitConfig...");
    const rateLimit = await prisma.rateLimitConfig.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        maxPerHour: 50,
        minDelayMs: 2000,
      },
    });
    console.log("✅ RateLimitConfig created:", { id: rateLimit.id, maxPerHour: rateLimit.maxPerHour });

    // 5. Insert ScheduledEmail
    console.log("\n5. Inserting ScheduledEmail...");
    const testJobId = `job_${Date.now()}`;
    const scheduledEmail = await prisma.scheduledEmail.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        recipientEmail: "recipient@example.com",
        subject: "Hello from ReachInbox",
        body: "This is a test scheduled email body",
        scheduledAt: new Date(Date.now() + 60000),
        status: "PENDING",
        jobId: testJobId,
      },
    });
    console.log("✅ ScheduledEmail created:", {
      id: scheduledEmail.id,
      status: scheduledEmail.status,
      jobId: scheduledEmail.jobId,
    });

    // 6. Insert SlackIntegration
    console.log("\n6. Inserting SlackIntegration...");
    const slack = await prisma.slackIntegration.create({
      data: {
        userId: user.id,
        teamId: "T123456",
        teamName: "ReachInbox Workspace",
        webhookUrl: "https://slack-test-webhook.local/alerts",
        channel: "#alerts",
      },
    });
    console.log("✅ SlackIntegration created:", { id: slack.id, teamName: slack.teamName });

    // 7. Query with Relations
    console.log("\n7. Querying User with all nested relations...");
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        senders: {
          include: {
            scheduledEmails: true,
            rateLimitConfig: true,
          },
        },
        slackIntegration: true,
      },
    });

    console.log("✅ Query successful. Retrieved User:", {
      id: fullUser?.id,
      sendersCount: fullUser?.senders.length,
      emailsCount: fullUser?.senders[0]?.scheduledEmails.length,
      hasSlack: !!fullUser?.slackIntegration,
    });

    // 8. Test Idempotency / Unique JobId constraint
    console.log("\n8. Testing Unique JobId constraint for idempotency...");
    try {
      await prisma.scheduledEmail.create({
        data: {
          userId: user.id,
          senderId: sender.id,
          recipientEmail: "duplicate@example.com",
          subject: "Duplicate Job Id Test",
          body: "Should fail due to unique constraint",
          scheduledAt: new Date(),
          status: "PENDING",
          jobId: testJobId,
        },
      });
      throw new Error("❌ Unique constraint on jobId failed to trigger!");
    } catch (e: any) {
      if (e.code === "P2002") {
        console.log("✅ Unique constraint on jobId correctly enforced (P2002).");
      } else {
        throw e;
      }
    }

    // 9. Clean up test user (Cascade delete will clean related records)
    console.log("\n9. Cleaning up test user and cascading relations...");
    await prisma.user.delete({ where: { id: user.id } });
    console.log("✅ Cleanup complete.");

    console.log("\n🎉 ALL DATABASE LAYER TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("\n❌ Test failed with error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDbTests();
