import React, { useState, useEffect, useRef } from "react";
import { QueueCounts, QueueJobState } from "../types";
import { api, getAuthToken, API_BASE } from "../lib/api";
import { QueueJobsTable } from "./QueueJobsTable";
import {
  Clock,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Activity,
  Radio,
} from "lucide-react";

const INITIAL_COUNTS: QueueCounts = {
  waiting: 0,
  active: 0,
  delayed: 0,
  completed: 0,
  failed: 0,
  paused: 0,
};

export const QueueOverview: React.FC = () => {
  const [counts, setCounts] = useState<QueueCounts>(INITIAL_COUNTS);
  const [selectedState, setSelectedState] = useState<QueueJobState>("delayed");
  const [isSseActive, setIsSseActive] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let sseWorking = false;

    const startPolling = () => {
      if (pollIntervalRef.current) return;
      // Immediate fetch
      api
        .getQueueCounts()
        .then((res) => {
          if (res?.counts) setCounts(res.counts);
        })
        .catch(console.error);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.getQueueCounts();
          if (res?.counts) setCounts(res.counts);
        } catch (err) {
          console.error("Queue count poll error:", err);
        }
      }, 3000);
    };

    // Try EventSource
    try {
      const token = getAuthToken();
      const sseUrl = `${API_BASE}/api/queue/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener("counts", (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          setCounts(parsed);
          setIsSseActive(true);
          sseWorking = true;
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } catch (e) {
          console.error("Failed to parse SSE counts payload:", e);
        }
      });

      es.onopen = () => {
        setIsSseActive(true);
      };

      es.onerror = () => {
        setIsSseActive(false);
        if (!sseWorking) {
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const statCards: Array<{
    id: QueueJobState;
    label: string;
    count: number;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    highlight?: boolean;
  }> = [
    {
      id: "delayed",
      label: "Delayed / Scheduled",
      count: counts.delayed,
      icon: <Clock className="w-4 h-4 text-[#B45309]" />,
      color: "text-[#B45309]",
      bgColor: "bg-[#FFFBEB]",
      borderColor: "border-[#FDE68A]",
      highlight: true,
    },
    {
      id: "active",
      label: "Active Processing",
      count: counts.active,
      icon: <PlayCircle className="w-4 h-4 text-[#00A859]" />,
      color: "text-[#00A859]",
      bgColor: "bg-[#F0FDF4]",
      borderColor: "border-[#BBF7D0]",
    },
    {
      id: "waiting",
      label: "Waiting in Queue",
      count: counts.waiting,
      icon: <PauseCircle className="w-4 h-4 text-[#4338CA]" />,
      color: "text-[#4338CA]",
      bgColor: "bg-[#EEF2FF]",
      borderColor: "border-[#C7D2FE]",
    },
    {
      id: "completed",
      label: "Completed",
      count: counts.completed,
      icon: <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />,
      color: "text-[#16A34A]",
      bgColor: "bg-[#F4FDF7]",
      borderColor: "border-[#E5E7EB]",
    },
    {
      id: "failed",
      label: "Failed",
      count: counts.failed,
      icon: <AlertCircle className="w-4 h-4 text-[#DC2626]" />,
      color: "text-[#DC2626]",
      bgColor: "bg-[#FEF2F2]",
      borderColor: "border-[#FECACA]",
    },
  ];

  return (
    <div className="w-full py-2 space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4F5F6]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EAF7EE] text-[#00A859] flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-[#1F2937] leading-none">
              BullMQ Queue Monitor
            </h2>
            <p className="text-[12px] text-[#9CA3AF] mt-1">
              Live telemetry from <span className="font-mono text-[#374151]">emailQueue</span> BullMQ instance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Real-time Status Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isSseActive
                ? "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]"
                : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]"
            }`}
          >
            <Radio className={`w-3 h-3 ${isSseActive ? "text-[#15803D] animate-pulse" : "text-[#94A3B8]"}`} />
            <span>{isSseActive ? "Live SSE Stream (2s)" : "Polling Fallback (3s)"}</span>
          </div>

          {/* Link to Bull Board */}
          <a
            href={`${API_BASE}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00A859] text-[#00A859] hover:bg-[#EAF7EE] text-[12px] font-medium transition-colors cursor-pointer"
          >
            <span>Bull Board</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 5-6 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card) => {
          const isSelected = selectedState === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedState(card.id)}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                isSelected
                  ? `ring-2 ring-[#00A859] bg-white shadow-sm border-transparent`
                  : `bg-white hover:bg-[#FAFBFB] border-[#EDEDED]`
              }`}
            >
              {card.highlight && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-[#F59E0B] rounded-bl" />
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-[#6B7280] truncate mr-1">
                  {card.label}
                </span>
                <div className={`p-1 rounded-md ${card.bgColor}`}>{card.icon}</div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[24px] font-bold leading-tight ${card.highlight ? "text-[#B45309]" : "text-[#1F2937]"}`}>
                  {card.count}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">jobs</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Tabs & Job Table Section */}
      <div className="bg-white rounded-xl border border-[#EDEDED] overflow-hidden shadow-xs">
        {/* State Tab Strip */}
        <div className="flex items-center overflow-x-auto px-3 pt-2 bg-[#FAFAFA] border-b border-[#EDEDED] gap-1">
          {statCards.map((tab) => {
            const isActive = selectedState === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedState(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium rounded-t-lg transition-colors cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
                  isActive
                    ? "text-[#00A859] border-[#00A859] bg-white font-semibold shadow-xs"
                    : "text-[#6B7280] border-transparent hover:text-[#1F2937] hover:bg-white/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? "bg-[#EAF7EE] text-[#00A859]"
                      : "bg-[#E5E7EB] text-[#4B5563]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected State Job Table */}
        <QueueJobsTable state={selectedState} />
      </div>
    </div>
  );
};

export default QueueOverview;
