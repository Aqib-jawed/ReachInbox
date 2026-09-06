import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../config/db";

describe("Worker Atomic Job Claiming Concurrency", () => {
  let testUserId: string;
  let testSenderId: string;
  let testEmailId: string;

  beforeAll(async () => {
    // Create test user and sender
    const user = await prisma.user.create({
      data: {
        googleId: `concurrency-test-${Date.now()}`,
        email: `concurrency-${Date.now()}@example.com`,
        name: "Concurrency Test User",
      },
    });
    testUserId = user.id;

    const sender = await prisma.sender.create({
      data: {
        userId: testUserId,
        etherealEmail: `concurrency-sender-${Date.now()}@ethereal.email`,
        etherealPassword: "password123",
      },
    });
    testSenderId = sender.id;

    const email = await prisma.scheduledEmail.create({
      data: {
        userId: testUserId,
        senderId: testSenderId,
        recipientEmail: "claim-target@example.com",
        subject: "Atomic Claim Test",
        body: "Testing concurrent claim exclusion",
        scheduledAt: new Date(Date.now() + 60000),
        status: "PENDING",
      },
    });
    testEmailId = email.id;
  });

  afterAll(async () => {
    // Cleanup test records
    try {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("ensures two concurrent worker claim calls result in exactly one successful claim", async () => {
    // Simulated atomic claim function executed concurrently by two workers
    const claimJob = async (workerName: string) => {
      // Atomic conditional update: only transitions if status is PENDING or RESCHEDULED
      const result = await prisma.scheduledEmail.updateMany({
        where: {
          id: testEmailId,
          status: { in: ["PENDING", "RESCHEDULED"] },
        },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      return {
        worker: workerName,
        claimed: result.count === 1,
        count: result.count,
      };
    };

    // Fire two claim requests at the exact same millisecond
    const [claimA, claimB] = await Promise.all([
      claimJob("Worker-A"),
      claimJob("Worker-B"),
    ]);

    // Exactly one worker must succeed (count = 1), and the other must get count = 0
    const totalClaimed = (claimA.claimed ? 1 : 0) + (claimB.claimed ? 1 : 0);
    expect(totalClaimed).toBe(1);

    const counts = [claimA.count, claimB.count].sort();
    expect(counts).toEqual([0, 1]);

    // Verify DB state is now PROCESSING and attempts is 1
    const finalRecord = await prisma.scheduledEmail.findUnique({
      where: { id: testEmailId },
    });
    expect(finalRecord?.status).toBe("PROCESSING");
    expect(finalRecord?.attempts).toBe(1);
  });
});
