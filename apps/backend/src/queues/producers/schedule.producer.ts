import { prisma } from "../../config/db";
import { emailQueue, EmailJobData } from "../email.queue";
import pino from "pino";

const logger = pino({
  name: "schedule-producer",
  level: process.env.LOG_LEVEL || "info",
});

export interface ScheduleBatchInput {
  userId: string;
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string | Date;
  delayBetweenMs?: number;
  hourlyLimit?: number;
}

export interface ScheduledEmailDto {
  id: string;
  recipientEmail: string;
  scheduledAt: Date;
  jobId: string;
  delayMs: number;
}

export interface ScheduleBatchResult {
  totalScheduled: number;
  senderId: string;
  scheduledEmails: ScheduledEmailDto[];
}

export async function scheduleEmailBatch(input: ScheduleBatchInput): Promise<ScheduleBatchResult> {
  const minDelayMs = parseInt(process.env.MIN_DELAY_MS || "2000", 10);
  const delayBetweenMs = Math.max(input.delayBetweenMs || 0, minDelayMs);
  const baseStartTime = input.startTime ? new Date(input.startTime) : new Date();
  const now = Date.now();

  // Validate sender belongs to user or exists
  const sender = await prisma.sender.findUnique({
    where: { id: input.senderId },
  });

  if (!sender) {
    throw new Error(`Sender with ID ${input.senderId} not found`);
  }

  const scheduledResults: ScheduledEmailDto[] = [];

  for (let i = 0; i < input.recipients.length; i++) {
    const recipient = input.recipients[i]!.trim();
    if (!recipient) continue;

    // Compute target send time for this recipient: startTime + (index * delayBetweenMs)
    const targetTimeMs = Math.max(baseStartTime.getTime() + i * delayBetweenMs, now);
    const targetScheduledDate = new Date(targetTimeMs);
    const delayMs = Math.max(0, targetTimeMs - now);

    // 1. Insert ScheduledEmail in DB with PENDING status
    const scheduledEmail = await prisma.scheduledEmail.create({
      data: {
        userId: input.userId,
        senderId: input.senderId,
        recipientEmail: recipient,
        subject: input.subject,
        body: input.body,
        scheduledAt: targetScheduledDate,
        status: "PENDING",
      },
    });

    const jobId = scheduledEmail.id;

    // 2. Enqueue BullMQ delayed job using scheduledEmail.id as unique jobId (idempotency key)
    const jobData: EmailJobData = {
      scheduledEmailId: scheduledEmail.id,
      senderId: input.senderId,
      userId: input.userId,
      recipientEmail: recipient,
      subject: input.subject,
      body: input.body,
      hourlyLimit: input.hourlyLimit,
    };

    await emailQueue.add("send-email", jobData, {
      jobId, // Idempotency key: BullMQ rejects duplicate job IDs
      delay: delayMs,
    });

    // 3. Update DB record with the confirmed jobId
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmail.id },
      data: { jobId },
    });

    scheduledResults.push({
      id: scheduledEmail.id,
      recipientEmail: recipient,
      scheduledAt: targetScheduledDate,
      jobId,
      delayMs,
    });
  }

  logger.info(
    {
      senderId: input.senderId,
      count: scheduledResults.length,
      firstScheduledAt: scheduledResults[0]?.scheduledAt,
      lastScheduledAt: scheduledResults[scheduledResults.length - 1]?.scheduledAt,
    },
    "Email batch successfully enqueued"
  );

  return {
    totalScheduled: scheduledResults.length,
    senderId: input.senderId,
    scheduledEmails: scheduledResults,
  };
}
