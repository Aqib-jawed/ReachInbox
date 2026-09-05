import { Worker, Job } from "bullmq";
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from "../email.queue";
import { createRedisConnection } from "../../config/redis";
import { prisma } from "../../config/db";
import { checkAndIncrementRateLimit } from "../limiter/rate-limiter";
import { sendEmailViaEthereal } from "../../integrations/ethereal/mailer";
import pino from "pino";

const logger = pino({
  name: "email-worker",
  level: process.env.LOG_LEVEL || "info",
});

export async function processEmailJob(job: Job<EmailJobData>) {
  const { scheduledEmailId, senderId, recipientEmail, subject, body, hourlyLimit } = job.data;

  logger.info({ jobId: job.id, scheduledEmailId, recipientEmail }, "Processing email job");

  // Step 1: Idempotency DB guard
  // Atomically claim the job by transitioning from PENDING/RESCHEDULED to PROCESSING
  const emailRecord = await prisma.scheduledEmail.findUnique({
    where: { id: scheduledEmailId },
    include: {
      sender: {
        include: {
          rateLimitConfig: true,
        },
      },
    },
  });

  if (!emailRecord) {
    logger.warn({ scheduledEmailId }, "Scheduled email record not found in DB. Skipping.");
    return { skipped: true, reason: "NOT_FOUND" };
  }

  if (emailRecord.status === "SENT") {
    logger.info({ scheduledEmailId }, "Email already sent (idempotency guard triggered). Skipping.");
    return { skipped: true, reason: "ALREADY_SENT" };
  }

  // Atomically update status to PROCESSING
  await prisma.scheduledEmail.update({
    where: { id: scheduledEmailId },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  // Step 2: Rate limit check (Redis-backed, cross-worker safe)
  const defaultLimit = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || "50", 10);
  const maxPerHour =
    hourlyLimit || emailRecord.sender.rateLimitConfig?.maxPerHour || defaultLimit;

  const rateLimitResult = await checkAndIncrementRateLimit(senderId, maxPerHour);

  if (!rateLimitResult.allowed) {
    // Reschedule for next open hour window without dropping or failing the job
    const nextWindowAt = rateLimitResult.nextWindowAt;
    const delayMs = rateLimitResult.delayToNextWindowMs;

    logger.warn(
      {
        scheduledEmailId,
        senderId,
        currentCount: rateLimitResult.currentCount,
        maxPerHour,
        nextWindowAt,
        delayMs,
      },
      "Hourly rate limit reached. Rescheduling email to next window."
    );

    // Update DB status to RESCHEDULED
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: {
        status: "RESCHEDULED",
        scheduledAt: nextWindowAt,
      },
    });

    // Enqueue new delayed job for the next window
    const newJobId = `${scheduledEmailId}_rescheduled_${nextWindowAt.getTime()}`;
    await emailQueue.add(
      "send-email",
      {
        ...job.data,
      },
      {
        jobId: newJobId,
        delay: delayMs,
      }
    );

    // Slack alert notification hook (Phase 5 integration)
    try {
      const { notifyRateLimitBreach } = await import("../../integrations/slack/notifier");
      await notifyRateLimitBreach(emailRecord.userId, {
        senderEmail: emailRecord.sender.etherealEmail,
        currentCount: rateLimitResult.currentCount,
        maxPerHour,
        rescheduledTo: nextWindowAt,
      });
    } catch {
      // Non-blocking if Slack integration is not configured yet
    }

    return {
      status: "rescheduled",
      rescheduledTo: nextWindowAt,
    };
  }

  // Step 3: Send the email via Ethereal SMTP
  try {
    const sendResult = await sendEmailViaEthereal({
      host: emailRecord.sender.host,
      port: emailRecord.sender.port,
      user: emailRecord.sender.etherealEmail,
      pass: emailRecord.sender.etherealPassword,
      to: recipientEmail,
      subject,
      body,
    });

    const sentAt = new Date();

    // Mark as SENT in DB
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: {
        status: "SENT",
        sentAt,
        errorMessage: null,
      },
    });

    logger.info(
      {
        scheduledEmailId,
        messageId: sendResult.messageId,
        previewUrl: sendResult.previewUrl,
      },
      "Email marked as SENT in database"
    );

    // Elasticsearch Indexing hook (Phase 4 integration)
    try {
      const { indexEmailDocument } = await import("../../integrations/elasticsearch/indexer");
      await indexEmailDocument({
        id: scheduledEmailId,
        userId: emailRecord.userId,
        senderId,
        senderEmail: emailRecord.sender.etherealEmail,
        recipientEmail,
        subject,
        body,
        status: "SENT",
        scheduledAt: emailRecord.scheduledAt,
        sentAt,
      });
    } catch {
      // Non-blocking if Elasticsearch is not yet connected
    }

    return {
      status: "sent",
      messageId: sendResult.messageId,
      previewUrl: sendResult.previewUrl,
    };
  } catch (err: any) {
    logger.error({ err, scheduledEmailId }, "Failed to send email via SMTP");

    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: {
        status: "FAILED",
        errorMessage: err?.message || "Unknown SMTP delivery error",
      },
    });

    throw err;
  }
}

export function createEmailWorker(concurrency?: number) {
  const workerConcurrency =
    concurrency || parseInt(process.env.WORKER_CONCURRENCY || "5", 10);

  logger.info({ concurrency: workerConcurrency }, "Initializing BullMQ Email Worker");

  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: workerConcurrency,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Job completed successfully");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Job failed");
  });

  return worker;
}
