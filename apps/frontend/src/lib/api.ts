import { SchedulePayload, ScheduledEmail, Sender, User } from "../types";

const API_BASE = "";

function getAuthToken(): string | null {
  return localStorage.getItem("reachinbox_auth_token");
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("reachinbox_auth_token", token);
  } else {
    localStorage.removeItem("reachinbox_auth_token");
  }
}

export function removeAuthToken() {
  localStorage.removeItem("reachinbox_auth_token");
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "An unexpected error occurred");
  }
  return data;
}

export const api = {
  // Auth
  devLogin: (email: string, name?: string) =>
    fetchWithAuth("/api/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }),

  getCurrentUser: (): Promise<{ success: boolean; user: User }> =>
    fetchWithAuth("/api/auth/me"),

  logout: () => {
    removeAuthToken();
    return fetchWithAuth("/api/auth/logout", { method: "POST" });
  },

  // Emails
  scheduleBatch: (payload: SchedulePayload) =>
    fetchWithAuth("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getScheduledEmails: (userId: string): Promise<{ success: boolean; count: number; data: ScheduledEmail[] }> =>
    fetchWithAuth(`/api/emails/scheduled?userId=${userId}`),

  getSentEmails: (userId: string): Promise<{ success: boolean; count: number; data: ScheduledEmail[] }> =>
    fetchWithAuth(`/api/emails/sent?userId=${userId}`),

  searchEmails: (
    userId: string,
    query: string,
    status?: string
  ): Promise<{ success: boolean; source: string; total: number; data: ScheduledEmail[] }> =>
    fetchWithAuth(`/api/emails/search?userId=${userId}&q=${encodeURIComponent(query)}${status ? `&status=${status}` : ""}`),

  // Senders
  getSenders: (userId: string): Promise<{ success: boolean; count: number; data: Sender[] }> =>
    fetchWithAuth(`/api/senders?userId=${userId}`),

  createSender: (payload: { userId: string; etherealEmail?: string; etherealPassword?: string; maxPerHour?: number; minDelayMs?: number }) =>
    fetchWithAuth("/api/senders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Slack
  getSlackStatus: (userId: string): Promise<{ connected: boolean; integration: any }> =>
    fetchWithAuth(`/api/slack/status?userId=${userId}`),

  disconnectSlack: (userId: string) =>
    fetchWithAuth("/api/slack/disconnect", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
};
