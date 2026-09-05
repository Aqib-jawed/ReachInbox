import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { scheduleEmailBatch } from "../queues/producers/schedule.producer";
import { prisma } from "../config/db";

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
        status: { in: ["SENT", "FAILED"] },
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

