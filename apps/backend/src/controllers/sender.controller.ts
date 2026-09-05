import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import nodemailer from "nodemailer";

const createSenderSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  etherealEmail: z.string().email().optional(),
  etherealPassword: z.string().optional(),
  host: z.string().default("smtp.ethereal.email"),
  port: z.number().int().default(587),
  maxPerHour: z.number().int().positive().default(50),
  minDelayMs: z.number().int().nonnegative().default(2000),
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

    res.status(200).json({
      success: true,
      count: senders.length,
      data: senders,
    });
  } catch (error) {
    next(error);
  }
}
