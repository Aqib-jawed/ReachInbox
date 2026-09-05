import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-queue";

export interface EmailJobData {
  scheduledEmailId: string;
  senderId: string;
  userId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  hourlyLimit?: number;
}

// Queue instance with dedicated Redis connection
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // keep completed jobs for 24h for Bull Board inspection
      count: 1000,
    },
    removeOnFail: {
      age: 86400 * 7, // keep failed jobs for 7 days
    },
  },
});
