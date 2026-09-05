import React, { useState, useEffect, useCallback } from "react";
import { QueueJob, QueueJobState } from "../types";
import { api } from "../lib/api";
import { Clock, CheckCircle2, AlertCircle, PlayCircle, PauseCircle, RefreshCw } from "lucide-react";

interface QueueJobsTableProps {
  state: QueueJobState;
  onSelectJob?: (job: QueueJob) => void;
}

function formatEta(timestamp: number, delayMs?: number | null): string {
  if (!delayMs || delayMs <= 0) return "Ready / Instant";
  const targetTime = timestamp + delayMs;
  const now = Date.now();
  const diffMs = targetTime - now;

  if (diffMs <= 0) return "Due now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `in ${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  const remSec = diffSec % 60;
  if (diffMin < 60) return `in ${diffMin}m ${remSec}s`;

  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  return `in ${diffHr}h ${remMin}m`;
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export const QueueJobsTable: React.FC<QueueJobsTableProps> = ({ state }) => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchJobs = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    try {
      const res = await api.getQueueJobs(state, 0, 50);
      setJobs(res.jobs || []);
    } catch (err) {
      console.error("Failed to fetch queue jobs:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [state]);

  useEffect(() => {
    fetchJobs(true);
    const interval = setInterval(() => {
      fetchJobs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const getStateBadge = (jobState: QueueJobState) => {
    switch (jobState) {
      case "delayed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
            <Clock className="w-3 h-3 text-[#B45309]" />
            <span>Delayed</span>
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
            <PlayCircle className="w-3 h-3 text-[#15803D] animate-spin" />
            <span>Active</span>
          </span>
        );
      case "waiting":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE]">
            <PauseCircle className="w-3 h-3 text-[#4338CA]" />
            <span>Waiting</span>
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
            <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
            <span>Completed</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
            <AlertCircle className="w-3 h-3 text-[#B91C1C]" />
            <span>Failed</span>
          </span>
        );
    }
  };

  const getEmptyMessage = () => {
    switch (state) {
      case "delayed":
        return {
          title: "No delayed jobs",
          desc: "All scheduled emails have either been processed or are waiting for dispatch.",
        };
      case "active":
        return {
          title: "No active jobs currently running",
          desc: "Workers are ready and waiting for the next job trigger.",
        };
      case "waiting":
        return {
          title: "No waiting jobs in queue",
          desc: "Queue is clear and ready for new email batches.",
        };
      case "completed":
        return {
          title: "No completed jobs yet",
          desc: "Jobs will appear here as soon as workers successfully dispatch them.",
        };
      case "failed":
        return {
          title: "No failed jobs",
          desc: "Everything is healthy — zero errors recorded in the queue.",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#9CA3AF]">
        <div className="w-7 h-7 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px]">Loading BullMQ jobs for state: {state}...</span>
      </div>
    );
  }

  if (jobs.length === 0) {
    const emptyInfo = getEmptyMessage();
    return (
      <div className="py-14 text-center px-4 border border-dashed border-[#EDEDED] rounded-xl bg-[#FAFAFA] my-4">
        <p className="text-[14px] font-semibold text-[#374151] mb-1">{emptyInfo.title}</p>
        <p className="text-[12.5px] text-[#9CA3AF] max-w-sm mx-auto">{emptyInfo.desc}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Table Header Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#FAFBFB] border-b border-[#F4F5F6] text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
        <span>Job Queue ({jobs.length} items)</span>
        <button
          type="button"
          onClick={() => fetchJobs(false)}
          disabled={isRefreshing}
          className="flex items-center gap-1 text-[#00A859] hover:underline cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#F4F5F6]">
        {jobs.map((job) => {
          const etaText = formatEta(job.timestamp, job.delay);
          const timeText = formatTimestamp(job.timestamp);

          return (
            <div
              key={job.id}
              className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FAFAFA] transition-colors duration-150 text-[13px]"
            >
              {/* Left Column: Recipient & Subject */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-40 sm:w-48 shrink-0 font-bold text-[#1F2937] truncate">
                  To: {job.toEmail.includes("@") ? job.toEmail.split("@")[0] : job.toEmail}
                </div>

                <div className="min-w-0 truncate">
                  <span className="font-semibold text-[#1F2937] mr-1.5">{job.subject}</span>
                  <span className="text-[11px] text-[#9CA3AF] font-mono">({job.id})</span>
                </div>
              </div>

              {/* Right Column: State Badge, ETA / Timestamp, Attempts, Failed Reason */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                {getStateBadge(job.state)}

                {job.state === "delayed" ? (
                  <span className="text-[12px] font-medium text-[#B45309] font-mono">
                    {etaText}
                  </span>
                ) : (
                  <span className="text-[12px] text-[#6B7280] font-mono">
                    {timeText}
                  </span>
                )}

                <span className="text-[11px] px-2 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280] font-mono">
                  {job.attemptsMade} try
                </span>

                {job.failedReason && (
                  <span
                    title={job.failedReason}
                    className="max-w-[140px] truncate text-[11px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 cursor-help"
                  >
                    {job.failedReason}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QueueJobsTable;
