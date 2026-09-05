import { Router, Request, Response } from "express";
import { z } from "zod";
import { emailQueue } from "../queues/email.queue";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth.middleware";
import pino from "pino";

const logger = pino({
  name: "queue-routes",
  level: process.env.LOG_LEVEL || "info",
});

const router = Router();

const JobStateEnum = z.enum(["waiting", "active", "delayed", "completed", "failed"]);
type JobState = z.infer<typeof JobStateEnum>;

/**
 * GET /api/queue/counts
 * Returns live job counts across all queue states.
 */
router.get("/counts", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const counts = await emailQueue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "completed",
      "failed",
      "paused"
    );

    res.status(200).json({
      success: true,
      counts: {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        delayed: counts.delayed || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        paused: counts.paused || 0,
      },
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to get queue counts");
    res.status(500).json({
      error: { code: "QUEUE_COUNT_ERROR", message: "Failed to fetch queue job counts" },
    });
  }
});

/**
 * GET /api/queue/jobs?state=<waiting|active|delayed|completed|failed>&start=0&end=20
 * Returns paginated lightweight DTOs of jobs for a specific state.
 */
router.get("/jobs", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stateValidation = JobStateEnum.safeParse(req.query.state || "delayed");

    if (!stateValidation.success) {
      res.status(400).json({
        error: {
          code: "INVALID_STATE",
          message: "Invalid state. Must be one of: waiting, active, delayed, completed, failed",
        },
      });
      return;
    }

    const state: JobState = stateValidation.data;
    const start = Math.max(0, parseInt(String(req.query.start || "0"), 10) || 0);
    const rawEnd = Math.max(start, parseInt(String(req.query.end || "20"), 10) || 20);
    // Cap end - start at 100
    const end = Math.min(rawEnd, start + 100);

    let jobs: any[] = [];
    switch (state) {
      case "waiting":
        jobs = await emailQueue.getWaiting(start, end);
        break;
      case "active":
        jobs = await emailQueue.getActive(start, end);
        break;
      case "delayed":
        jobs = await emailQueue.getDelayed(start, end);
        break;
      case "completed":
        jobs = await emailQueue.getCompleted(start, end);
        break;
      case "failed":
        jobs = await emailQueue.getFailed(start, end);
        break;
      default:
        jobs = await emailQueue.getDelayed(start, end);
    }

    // Collect all referenced scheduledEmailIds for a single batched database query
    const emailIds = Array.from(
      new Set(
        jobs
          .map((job) => job.data?.scheduledEmailId || job.data?.emailId || job.id)
          .filter(Boolean)
      )
    );

    const emailRecords =
      emailIds.length > 0
        ? await prisma.scheduledEmail.findMany({
            where: {
              id: { in: emailIds },
            },
            select: {
              id: true,
              recipientEmail: true,
              subject: true,
              createdAt: true,
              scheduledAt: true,
              sentAt: true,
              status: true,
            },
          })
        : [];

    const emailRecordMap = new Map(emailRecords.map((r) => [r.id, r]));

    // Map each job to the requested DTO
    const dtos = jobs.map((job) => {
      const emailId = job.data?.scheduledEmailId || job.data?.emailId || job.id;
      const dbRecord = emailRecordMap.get(emailId);

      return {
        id: job.id,
        emailId,
        senderId: job.data?.senderId || null,
        state,
        delay: job.opts?.delay ?? null,
        timestamp: job.timestamp,
        processedOn: job.processedOn ?? null,
        finishedOn: job.finishedOn ?? null,
        attemptsMade: job.attemptsMade || 0,
        failedReason: job.failedReason ?? null,
        toEmail: dbRecord?.recipientEmail || job.data?.recipientEmail || "(unknown recipient)",
        subject: dbRecord?.subject || job.data?.subject || "(No subject)",
        createdAt: dbRecord?.createdAt || new Date(job.timestamp).toISOString(),
        scheduledAt: dbRecord?.scheduledAt || null,
        sentAt: dbRecord?.sentAt || null,
      };
    });

    res.status(200).json({
      success: true,
      state,
      start,
      end,
      count: dtos.length,
      jobs: dtos,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Failed to fetch queue jobs");
    res.status(500).json({
      error: { code: "QUEUE_JOBS_ERROR", message: "Failed to fetch queue jobs" },
    });
  }
});

/**
 * GET /api/queue/stream (Server-Sent Events)
 * Streams real-time queue counts every 2 seconds.
 */
router.get("/stream", requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable buffering for Nginx/Proxies
  });

  const sendCounts = async () => {
    try {
      const counts = await emailQueue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "completed",
        "failed",
        "paused"
      );

      const payload = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        delayed: counts.delayed || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        paused: counts.paused || 0,
        timestamp: Date.now(),
      };

      res.write(`event: counts\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Error pushing SSE queue counts");
    }
  };

  // Push immediate initial state
  await sendCounts();

  // Push updates every 2 seconds
  const interval = setInterval(sendCounts, 2000);

  // Clean up interval on client disconnect
  const cleanup = () => {
    clearInterval(interval);
    res.end();
  };

  req.on("close", cleanup);
  res.on("close", cleanup);
});

export default router;
