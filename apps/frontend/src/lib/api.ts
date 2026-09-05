import { SchedulePayload, ScheduledEmail, Sender, User } from "../types";

export const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://reachinbox-api-lbxm.onrender.com");

export function getAuthToken(): string | null {
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

  const endpoint = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { message: text || `HTTP ${response.status} ${response.statusText}` } };
  }

  if (!response.ok) {
    throw new Error(data.error?.message || `Request failed with status ${response.status}`);
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
  getSlackStatus: (id: string): Promise<{ connected: boolean; integration?: any; slackWebhookUrl?: string | null }> =>
    fetchWithAuth(`/api/slack/status/${id}`),

  disconnectSlack: (id: string) =>
    fetchWithAuth(`/api/slack/disconnect/${id}`, {
      method: "POST",
      body: JSON.stringify({ senderId: id, userId: id }),
    }),

  // Queue
  getQueueCounts: (): Promise<{ success: boolean; counts: { waiting: number; active: number; delayed: number; completed: number; failed: number; paused: number } }> =>
    fetchWithAuth("/api/queue/counts"),

  getQueueJobs: (
    state = "delayed",
    start = 0,
    end = 50
  ): Promise<{ success: boolean; state: string; count: number; jobs: any[] }> =>
    fetchWithAuth(`/api/queue/jobs?state=${state}&start=${start}&end=${end}`),
};
