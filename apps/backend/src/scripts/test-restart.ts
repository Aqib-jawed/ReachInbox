import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

import { prisma } from "../config/db";
import { scheduleEmailBatch } from "../queues/producers/schedule.producer";
import { createEmailWorker } from "../queues/workers/email.worker";
import { emailQueue } from "../queues/email.queue";

async function runRestartSurvivabilityTest() {
  console.log("🚀 Starting Restart Survivability & Idempotency Test...\n");

  const testUser = await prisma.user.create({
    data: {
      googleId: `restart_user_${Date.now()}`,
      email: `restart_${Date.now()}@example.com`,
      name: "Restart Tester",
    },
  });

  const testSender = await prisma.sender.create({
    data: {
      userId: testUser.id,
      etherealEmail: "restart_sender@ethereal.email",
      etherealPassword: "fake_pass_ethereal",
      rateLimitConfig: {
        create: {
          userId: testUser.id,
          maxPerHour: 100,
          minDelayMs: 500,
        },
      },
    },
  });

  try {
    // 1. Schedule a delayed job 3 seconds in the future
    console.log("1. Scheduling an email with 3-second delay...");
    const targetSendTime = new Date(Date.now() + 3000);
    const batch = await scheduleEmailBatch({
      userId: testUser.id,
      senderId: testSender.id,
      recipients: ["restart_recipient@example.com"],
      subject: "Restart Survivability Test",
      body: "Testing that delayed job survives worker crash/restart",
      startTime: targetSendTime,
      delayBetweenMs: 1000,
    });

    const scheduledId = batch.scheduledEmails[0]?.id;
    console.log(`✅ Job enqueued in Redis: ${scheduledId}`);

    // 2. Start Worker 1
    console.log("\n2. Spawning Worker 1...");
    let worker = createEmailWorker(1);

    // 3. Immediately kill Worker 1 before the job fires!
    console.log("3. Simulating Worker Crash / Kill mid-flight...");
    await new Promise((r) => setTimeout(r, 500));
    await worker.close();
    console.log("💥 Worker 1 terminated abruptly before send time.");

    // 4. Verify DB status is still PENDING
    const beforeRestart = await prisma.scheduledEmail.findUnique({
      where: { id: scheduledId },
    });
    console.log(`- DB status while worker is dead: ${beforeRestart?.status} (Expected: PENDING)`);

    // 5. Wait past scheduled send time while no worker is running
    console.log("\n4. Waiting past scheduled send time while worker is offline...");
    await new Promise((r) => setTimeout(r, 3500));

    // 6. Spawn Worker 2 (Simulate restart)
    console.log("\n5. Restarting new Worker 2 process...");
    worker = createEmailWorker(1);

    // Wait and poll for worker to complete the job
    console.log("⏳ Worker 2 picking up pending job from Redis persistence and delivering...");
    let afterRestart = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      afterRestart = await prisma.scheduledEmail.findUnique({
        where: { id: scheduledId },
      });
      if (afterRestart?.status === "SENT") break;
    }

    // 7. Inspect final DB state
    console.log("\n6. Inspecting final job status in Database:");
    console.log(`- Status:     ${afterRestart?.status} (Expected: SENT)`);
    console.log(`- Attempts:   ${afterRestart?.attempts} (Expected: 1)`);
    console.log(`- SentAt:     ${afterRestart?.sentAt?.toISOString()}`);

    if (afterRestart?.status === "SENT" && afterRestart.attempts === 1) {
      console.log("\n✅ RESTART SURVIVABILITY TEST PASSED: Job survived worker kill and executed exactly once!");
    } else {
      throw new Error(`Unexpected status after restart: ${afterRestart?.status}`);
    }

    // Cleanup
    await worker.close();
    await emailQueue.drain();
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log("✅ Test cleanup complete.\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Restart test failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await emailQueue.close();
  }
}

runRestartSurvivabilityTest();
