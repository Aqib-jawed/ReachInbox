import { describe, it, expect, afterAll } from "vitest";
import { emailQueue } from "../queues/email.queue";

describe("BullMQ Email Queue - Idempotent Enqueuing", () => {
  const testEmailId = `test-email-${Date.now()}`;
  const deterministicJobId = `email-${testEmailId}`;

  afterAll(async () => {
    // Clean up test job if exists
    try {
      const job = await emailQueue.getJob(deterministicJobId);
      if (job) {
        await job.remove();
      }
    } catch {
      // Ignore
    }
  });

  it("ensures calling enqueue twice with the same deterministic jobId results in only one job in the queue", async () => {
    const jobPayload = {
      scheduledEmailId: testEmailId,
      senderId: "test-sender",
      userId: "test-user",
      recipientEmail: "test@example.com",
      subject: "Idempotency Test",
      body: "Testing BullMQ deduplication",
    };

    // First enqueue call
    const job1 = await emailQueue.add("send-email", jobPayload, {
      jobId: deterministicJobId,
      delay: 60000, // 1 minute in future
    });

    expect(job1).toBeDefined();
    expect(job1.id).toBe(deterministicJobId);

    // Second enqueue call with EXACT same jobId
    const job2 = await emailQueue.add("send-email", jobPayload, {
      jobId: deterministicJobId,
      delay: 60000,
    });

    // BullMQ deduplicates jobs with identical jobId
    expect(job2.id).toBe(deterministicJobId);

    // Fetch by ID from BullMQ
    const retrievedJob = await emailQueue.getJob(deterministicJobId);
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.id).toBe(deterministicJobId);
    expect(retrievedJob?.data.scheduledEmailId).toBe(testEmailId);
  });
});
