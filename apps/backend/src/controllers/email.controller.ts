import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { scheduleEmailBatch } from "../queues/producers/schedule.producer";
import { emailQueue } from "../queues/email.queue";
import { prisma } from "../config/db";
import logger from "../lib/logger";

// Validation schema for scheduling emails
const scheduleSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  senderId: z.string().min(1, "senderId is required"),
  recipients: z.array(z.string().email("Invalid recipient email address")).min(1, "At least one recipient is required"),
  subject: z.string().min(1, "Subject cannot be empty"),
  body: z.string().min(1, "Body cannot be empty"),
  startTime: z.string().datetime().or(z.string()).optional(),
  delayBetweenMs: z.number().int().min(0).optional(),
  hourlyLimit: z.number().int().positive().optional(),
});

export async function handleScheduleEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = scheduleSchema.parse(req.body);
    const result = await scheduleEmailBatch(validatedData);

    logger.info(
      { totalScheduled: result.totalScheduled, userId: validatedData.userId, senderId: validatedData.senderId },
      "Scheduled email batch successfully"
    );

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${result.totalScheduled} email(s)`,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        },
      });
      return;
    }
    next(error);
  }
}

export async function handleGetScheduledEmails(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, senderId, limit = "50", offset = "0" } = req.query;

    const emails = await prisma.scheduledEmail.findMany({
      where: {
        ...(userId ? { userId: String(userId) } : {}),
        ...(senderId ? { senderId: String(senderId) } : {}),
        status: { in: ["PENDING", "PROCESSING", "RESCHEDULED"] },
      },
      include: {
        sender: {
          select: {
            id: true,
            etherealEmail: true,
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: Math.min(parseInt(String(limit), 10), 100),
      skip: parseInt(String(offset), 10),
    });

    res.status(200).json({
      success: true,
      count: emails.length,
      data: emails,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetSentEmails(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, senderId, limit = "50", offset = "0" } = req.query;

    const emails = await prisma.scheduledEmail.findMany({
      where: {
        ...(userId ? { userId: String(userId) } : {}),
        ...(senderId ? { senderId: String(senderId) } : {}),
        status: { in: ["SENT", "FAILED", "CANCELLED"] },
      },
      include: {
        sender: {
          select: {
            id: true,
            etherealEmail: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: Math.min(parseInt(String(limit), 10), 100),
      skip: parseInt(String(offset), 10),
    });

    res.status(200).json({
      success: true,
      count: emails.length,
      data: emails,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleSearchEmails(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, q, status, limit = "50", offset = "0" } = req.query;

    const { searchEmails } = await import("../integrations/elasticsearch/indexer");
    const results = await searchEmails({
      userId: userId ? String(userId) : undefined,
      q: q ? String(q) : undefined,
      status: status ? String(status) : undefined,
      limit: Math.min(parseInt(String(limit), 10), 100),
      offset: parseInt(String(offset), 10),
    });

    res.status(200).json({
      success: true,
      ...results,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/emails/:id/cancel
 * Cancels a scheduled/pending email and removes it from BullMQ queue.
 */
export async function handleCancelEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const email = await prisma.scheduledEmail.findUnique({
      where: { id },
    });

    if (!email) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Scheduled email not found" },
      });
      return;
    }

    if (email.status !== "PENDING" && email.status !== "RESCHEDULED") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "Cannot cancel an email that has already started processing or completed",
        },
      });
      return;
    }

    const bullJobId = email.jobId ?? `email-${email.id}`;

    // Remove from BullMQ queue with race condition handling
    try {
      const job = await emailQueue.getJob(bullJobId);
      if (job) {
        await job.remove();
      }
    } catch (jobErr: any) {
      const freshEmail = await prisma.scheduledEmail.findUnique({ where: { id } });
      if (freshEmail && (freshEmail.status === "PROCESSING" || freshEmail.status === "SENT")) {
        res.status(409).json({
          error: {
            code: "CONFLICT",
            message: "Cannot cancel an email that has already started processing",
          },
        });
        return;
      }
      logger.warn(
        { emailId: email.id, jobId: bullJobId, err: jobErr?.message },
        "Non-fatal BullMQ job removal error on cancel"
      );
    }

    const updated = await prisma.scheduledEmail.update({
      where: { id },
      data: {
        status: "CANCELLED",
        updatedAt: new Date(),
      },
    });

    logger.info(
      { emailId: email.id, jobId: bullJobId, senderId: email.senderId },
      "Scheduled email cancelled successfully"
    );

    res.status(200).json({
      success: true,
      message: "Email cancelled successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/emails/:id/retry
 * Retries a failed email with a fresh BullMQ jobId and resets attempts.
 */
export async function handleRetryEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const email = await prisma.scheduledEmail.findUnique({
      where: { id },
    });

    if (!email) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Email not found" },
      });
      return;
    }

    if (email.status !== "FAILED") {
      res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: `Only failed emails can be retried. Current status is ${email.status}`,
        },
      });
      return;
    }

    // Default target time: now + 30 seconds, or custom provided in body
    const targetScheduledAt = req.body?.scheduledAt
      ? new Date(req.body.scheduledAt)
      : new Date(Date.now() + 30000);

    const delay = Math.max(0, targetScheduledAt.getTime() - Date.now());
    const freshJobId = `email-${email.id}-retry-${Date.now()}`;

    const updated = await prisma.scheduledEmail.update({
      where: { id },
      data: {
        status: "PENDING",
        attempts: 0,
        errorMessage: null,
        scheduledAt: targetScheduledAt,
        jobId: freshJobId,
        updatedAt: new Date(),
      },
    });

    await emailQueue.add(
      "send-email",
      {
        scheduledEmailId: email.id,
        senderId: email.senderId,
        userId: email.userId,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
      },
      {
        delay,
        jobId: freshJobId,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    logger.info(
      { emailId: email.id, jobId: freshJobId, senderId: email.senderId },
      "Failed email scheduled for retry with fresh BullMQ job"
    );

    res.status(200).json({
      success: true,
      message: "Email scheduled for retry",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
