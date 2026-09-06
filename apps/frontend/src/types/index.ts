export type EmailStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "RESCHEDULED" | "CANCELLED";

export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  senders?: Sender[];
  slackIntegration?: SlackIntegration | null;
}

export interface Sender {
  id: string;
  userId: string;
  etherealEmail: string;
  host: string;
  port: number;
  rateLimitConfig?: RateLimitConfig | null;
}

export interface RateLimitConfig {
  id: string;
  maxPerHour: number;
  minDelayMs: number;
}

export interface ScheduledEmail {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  scheduledTime?: string;
  sentAt?: string | null;
  sentTime?: string | null;
  status: EmailStatus;
  jobId?: string | null;
  attempts: number;
  errorMessage?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    etherealEmail: string;
  };
}

export type Email = ScheduledEmail;

export interface SlackIntegration {
  id: string;
  teamId?: string | null;
  teamName?: string | null;
  channel?: string | null;
  connectedAt: string;
}

export interface SchedulePayload {
  userId: string;
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenMs?: number;
  hourlyLimit?: number;
}

export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  paused: number;
  timestamp?: number;
}

export type QueueJobState = "waiting" | "active" | "delayed" | "completed" | "failed";

export interface QueueJob {
  id: string;
  emailId: string;
  senderId?: string | null;
  state: QueueJobState;
  delay?: number | null;
  timestamp: number;
  processedOn?: number | null;
  finishedOn?: number | null;
  attemptsMade: number;
  failedReason?: string | null;
  toEmail: string;
  subject: string;
  createdAt: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
}
