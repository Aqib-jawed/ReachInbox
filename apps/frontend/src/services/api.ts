import { api } from "@/lib/api";
import { Email, SchedulePayload } from "@/types";
import { useAuthStore } from "@/store/auth";

export const apiClient = {
  getScheduled: async (): Promise<{ data: Email[] }> => {
    const user = useAuthStore.getState().user;
    const userId = user?.id || "";
    const res = await api.getScheduledEmails(userId);
    const data: Email[] = (res.data || []).map((e) => ({
      ...e,
      scheduledTime: e.scheduledAt || e.scheduledTime || "",
    }));
    return { data };
  },

  getSent: async (): Promise<{ data: Email[] }> => {
    const user = useAuthStore.getState().user;
    const userId = user?.id || "";
    const res = await api.getSentEmails(userId);
    const data: Email[] = (res.data || []).map((e) => ({
      ...e,
      sentTime: e.sentAt || e.sentTime || "",
      scheduledTime: e.scheduledAt || e.scheduledTime || "",
    }));
    return { data };
  },

  schedule: async (form: {
    recipientEmail: string;
    senderEmail?: string;
    subject: string;
    body: string;
    scheduledTime?: string;
    delayBetweenMs?: number;
    hourlyLimit?: number;
    userId?: string;
    senderId?: string;
  }) => {
    const user = useAuthStore.getState().user;
    const userId = form.userId || user?.id || "default_user";
    let senderId = form.senderId;

    if (!senderId && user?.senders && user.senders.length > 0) {
      senderId = user.senders[0].id;
    }

    if (!senderId) {
      try {
        const sendersRes = await api.getSenders(userId);
        if (sendersRes.data && sendersRes.data.length > 0) {
          senderId = sendersRes.data[0].id;
        } else {
          const createdSender = await api.createSender({
            userId,
            etherealEmail: form.senderEmail || "noreply@reachinbox.ai",
          });
          senderId = (createdSender as any)?.data?.id || "default_sender";
        }
      } catch {
        senderId = "default_sender";
      }
    }

    const recipients = form.recipientEmail
      .split(/[\n,; ]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const payload: SchedulePayload = {
      userId,
      senderId: senderId || "default_sender",
      recipients: recipients.length > 0 ? recipients : [form.recipientEmail],
      subject: form.subject,
      body: form.body,
      startTime: form.scheduledTime ? new Date(form.scheduledTime).toISOString() : undefined,
      delayBetweenMs: form.delayBetweenMs,
      hourlyLimit: form.hourlyLimit,
    };

    return api.scheduleBatch(payload);
  },
};