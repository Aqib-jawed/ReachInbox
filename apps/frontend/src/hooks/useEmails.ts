import { useState, useEffect, useCallback, useRef } from "react";
import { ScheduledEmail } from "@/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface UseEmailsResult {
  scheduled: ScheduledEmail[];
  sent: ScheduledEmail[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmails(autoRefreshIntervalMs: number = 5000): UseEmailsResult {
  const { user } = useAuthStore();
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);

  const fetchEmails = useCallback(async () => {
    if (!user?.id) {
      setScheduled([]);
      setSent([]);
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setError(null);
      const [scheduledRes, sentRes] = await Promise.allSettled([
        api.getScheduledEmails(user.id),
        api.getSentEmails(user.id),
      ]);

      if (scheduledRes.status === "fulfilled" && scheduledRes.value?.data) {
        setScheduled(scheduledRes.value.data);
      }

      if (sentRes.status === "fulfilled" && sentRes.value?.data) {
        setSent(sentRes.value.data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to fetch emails");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user?.id]);

  // Initial fetch on mount or user change
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Auto-refresh interval (5 seconds default)
  useEffect(() => {
    if (!user?.id || autoRefreshIntervalMs <= 0) return;

    const interval = setInterval(() => {
      fetchEmails();
    }, autoRefreshIntervalMs);

    return () => clearInterval(interval);
  }, [user?.id, autoRefreshIntervalMs, fetchEmails]);

  return {
    scheduled,
    sent,
    loading,
    error,
    refetch: fetchEmails,
  };
}