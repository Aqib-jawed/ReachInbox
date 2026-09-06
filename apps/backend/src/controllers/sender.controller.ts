import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import nodemailer from "nodemailer";
import { getWarmupStatus, parseWarmupPlan } from "../services/warmup";
import logger from "../lib/logger";

const createSenderSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  etherealEmail: z.string().email().optional(),
  etherealPassword: z.string().optional(),
  host: z.string().default("smtp.ethereal.email"),
  port: z.number().int().default(587),
  maxPerHour: z.number().int().positive().default(50),
  minDelayMs: z.number().int().nonnegative().default(2000),
  warmupEnabled: z.boolean().optional(),
  warmupPlan: z.array(z.object({ day: z.number(), hourlyLimit: z.number() })).optional(),
});

export async function handleCreateSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createSenderSchema.parse(req.body);

    let etherealEmail = data.etherealEmail;
    let etherealPassword = data.etherealPassword;

    // Automatically generate real Ethereal credentials if none provided
    if (!etherealEmail || !etherealPassword) {
      const testAccount = await nodemailer.createTestAccount();
      etherealEmail = testAccount.user;
      etherealPassword = testAccount.pass;
    }

    const sender = await prisma.sender.create({
      data: {
        userId: data.userId,
        etherealEmail,
        etherealPassword,
        host: data.host,
        port: data.port,
        warmupEnabled: data.warmupEnabled || false,
        warmupStartedAt: data.warmupEnabled ? new Date() : null,
        warmupPlan: data.warmupPlan ? data.warmupPlan : undefined,
        rateLimitConfig: {
          create: {
            userId: data.userId,
            maxPerHour: data.maxPerHour,
            minDelayMs: data.minDelayMs,
          },
        },
      },
      include: {
        rateLimitConfig: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Sender account created successfully",
      data: sender,
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

export async function handleGetSenders(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.query;

    const senders = await prisma.sender.findMany({
      where: userId ? { userId: String(userId) } : {},
      include: {
        rateLimitConfig: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const sendersWithWarmup = senders.map((sender) => ({
      ...sender,
      warmupStatus: getWarmupStatus(sender, sender.rateLimitConfig?.maxPerHour || 50),
    }));

    res.status(200).json({
      success: true,
      count: sendersWithWarmup.length,
      data: sendersWithWarmup,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/senders/:id/warmup/start
 * Enables warm-up for a sender and starts the schedule clock.
 */
export async function handleStartWarmup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const sender = await prisma.sender.findUnique({
      where: { id },
      include: { rateLimitConfig: true },
    });

    if (!sender) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Sender not found" } });
      return;
    }

    // Idempotent: if already enabled and started, return current state
    if (sender.warmupEnabled && sender.warmupStartedAt) {
      const status = getWarmupStatus(sender, sender.rateLimitConfig?.maxPerHour || 50);
      res.status(200).json({
        success: true,
        message: "Warm-up is already active",
        data: status,
      });
      return;
    }

    const customPlan = req.body?.plan ? parseWarmupPlan(req.body.plan) : (sender.warmupPlan ?? undefined);

    const updated = await prisma.sender.update({
      where: { id },
      data: {
        warmupEnabled: true,
        warmupStartedAt: new Date(),
        warmupPlan: customPlan ? (customPlan as any) : undefined,
      },
      include: { rateLimitConfig: true },
    });

    const status = getWarmupStatus(updated, updated.rateLimitConfig?.maxPerHour || 50);

    logger.info(
      { senderId: id, effectiveLimit: status.currentEffectiveLimit, startedAt: status.startedAt },
      "Sender warm-up initiated"
    );

    res.status(200).json({
      success: true,
      message: "Sender warm-up initiated successfully",
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/senders/:id/warmup/stop
 * Disables warm-up for a sender, immediately reverting to configured hourly limit ceiling.
 */
export async function handleStopWarmup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const sender = await prisma.sender.findUnique({
      where: { id },
      include: { rateLimitConfig: true },
    });

    if (!sender) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Sender not found" } });
      return;
    }

    const updated = await prisma.sender.update({
      where: { id },
      data: {
        warmupEnabled: false,
      },
      include: { rateLimitConfig: true },
    });

    const status = getWarmupStatus(updated, updated.rateLimitConfig?.maxPerHour || 50);

    logger.info(
      { senderId: id, ceiling: status.ceilingLimit },
      "Sender warm-up disabled; full ceiling restored"
    );

    res.status(200).json({
      success: true,
      message: "Sender warm-up disabled. Reverted to full hourly limit.",
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/senders/:id/warmup/status
 * Returns current warm-up progression, effective limit, and upcoming steps.
 */
export async function handleGetWarmupStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const sender = await prisma.sender.findUnique({
      where: { id },
      include: { rateLimitConfig: true },
    });

    if (!sender) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Sender not found" } });
      return;
    }

    const status = getWarmupStatus(sender, sender.rateLimitConfig?.maxPerHour || 50);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}
