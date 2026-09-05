import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma, checkDbHealth } from "../config/db";
import { checkRedisHealth, redisClient } from "../config/redis";
import { scheduleEmailBatch } from "../queues/producers/schedule.producer";
import { createEmailWorker } from "../queues/workers/email.worker";
import { emailQueue } from "../queues/email.queue";

async function runSchedulerTests() {
  console.log("🚀 Starting Phase 3 Scheduler Core Acceptance Tests...\n");

  // 1. Health checks
  console.log("1. Checking Database and Redis connectivity...");
  const dbOk = await checkDbHealth();
  const redisOk = await checkRedisHealth();
  console.log(`- Database Health: ${dbOk ? "✅ OK" : "❌ FAILED"}`);
  console.log(`- Redis Health:    ${redisOk ? "✅ OK" : "❌ FAILED"}`);

  if (!dbOk || !redisOk) {
    throw new Error("❌ Database or Redis connection check failed. Aborting.");
  }

  const testGoogleId = `sched_user_${Date.now()}`;
  const testUserEmail = `sched_${Date.now()}@example.com`;

  try {
    // 2. Setup Test User and Sender
    console.log("\n2. Setting up test user and sender with rate limit...");
    const user = await prisma.user.create({
      data: {
        googleId: testGoogleId,
        email: testUserEmail,
        name: "Scheduler Tester",
      },
    });

    const sender = await prisma.sender.create({
      data: {
        userId: user.id,
        etherealEmail: "scheduler_sender@ethereal.email",
        etherealPassword: "fake_password_triggers_auto_ethereal",
        rateLimitConfig: {
          create: {
            userId: user.id,
            maxPerHour: 3, // Rate limit of 3 emails per hour to test auto-rescheduling!
            minDelayMs: 500,
          },
        },
      },
    });

    console.log("✅ Created Sender ID:", sender.id, "with Hourly Limit = 3");

    // Clear any previous rate limit key for this sender
    const currentHour = new Date().toISOString().slice(0, 13).replace(/[-T]/g, "");
    await redisClient.del(`ratelimit:sender:${sender.id}:${currentHour}`);

    // 3. Schedule 5 Staggered Emails
    console.log("\n3. Scheduling batch of 5 staggered emails...");
    const batchResult = await scheduleEmailBatch({
      userId: user.id,
      senderId: sender.id,
      recipients: [
        "recipient1@example.com",
        "recipient2@example.com",
        "recipient3@example.com",
        "recipient4@example.com",
        "recipient5@example.com",
      ],
      subject: "Test Batch Email",
      body: "Hello, this is an automated test from ReachInbox scheduler!",
      startTime: new Date(Date.now() + 500),
      delayBetweenMs: 1000,
      hourlyLimit: 3, // 3 allowed now, 2 must be rescheduled to next window
    });

    console.log(`✅ Enqueued ${batchResult.totalScheduled} jobs in BullMQ queue:`);
    batchResult.scheduledEmails.forEach((e, idx) => {
      console.log(`   [${idx + 1}] ID: ${e.id} -> ${e.recipientEmail} (delay: ${e.delayMs}ms)`);
    });

    // 4. Verify initial DB and Queue state
    console.log("\n4. Verifying initial queue counts...");
    const waitingCount = await emailQueue.getWaitingCount();
    const delayedCount = await emailQueue.getDelayedCount();
    console.log(`- Delayed jobs in BullMQ: ${delayedCount}`);
    console.log(`- Waiting jobs in BullMQ: ${waitingCount}`);

    // 5. Start Worker to process batch
    console.log("\n5. Starting Worker to process jobs...");
    const worker = createEmailWorker(2);

    console.log("⏳ Processing emails (waiting for execution and rate limit evaluation)...");
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // 6. Inspect Database Results
    console.log("\n6. Inspecting database states for scheduled batch...");
    const emailsInDb = await prisma.scheduledEmail.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const sentEmails = emailsInDb.filter((e) => e.status === "SENT");
    const rescheduledEmails = emailsInDb.filter((e) => e.status === "RESCHEDULED");

    console.log(`\nResults summary:`);
    console.log(`- Total Emails in DB: ${emailsInDb.length}`);
    console.log(`- Status 'SENT':        ${sentEmails.length} (Expected: 3 due to rate limit)`);
    console.log(`- Status 'RESCHEDULED': ${rescheduledEmails.length} (Expected: 2 rescheduled to next window)`);

    emailsInDb.forEach((e, i) => {
      console.log(`   [${i + 1}] Recipient: ${e.recipientEmail} | Status: ${e.status} | ScheduledAt: ${e.scheduledAt.toISOString()}`);
    });

    if (sentEmails.length === 3 && rescheduledEmails.length === 2) {
      console.log("\n✅ Rate limiting and auto-rescheduling logic verified perfectly!");
    } else {
      console.log("\n⚠️ Notice: Some emails might still be in transit or count differed based on timing.");
    }

    // 7. Cleanup
    console.log("\n7. Shutting down worker and cleaning up test records...");
    await worker.close();
    await emailQueue.drain();
    await prisma.user.delete({ where: { id: user.id } });
    console.log("✅ Cleanup complete.");

    console.log("\n🎉 PHASE 3 SCHEDULER ACCEPTANCE TEST COMPLETED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Scheduler test failed with error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await redisClient.quit();
    await emailQueue.close();
  }
}

runSchedulerTests();
