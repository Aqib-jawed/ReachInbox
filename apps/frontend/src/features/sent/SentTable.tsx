import React, { useState } from "react";
import { ScheduledEmail } from "../../types";
import { CheckCircle2, AlertCircle, RotateCw, Loader2, Ban, Inbox, Plus } from "lucide-react";
import { api } from "../../lib/api";

interface SentTableProps {
  emails: ScheduledEmail[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCompose: () => void;
  onSelectEmail?: (email: ScheduledEmail) => void;
  onToast?: (type: "success" | "error" | "info", title: string, message?: string) => void;
}

function formatDisplayTime(dateStr?: string | Date) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);

  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${weekday} ${time}`;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  isLoading,
  onRefresh,
  onOpenCompose,
  onSelectEmail,
  onToast,
}) => {
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  const [filterState, setFilterState] = useState<"all" | "sent" | "failed" | "cancelled">("all");

  const baseItems = emails || [];

  const displayItems = baseItems.filter((item) => {
    if (filterState === "all") return true;
    if (filterState === "sent") return item.status === "SENT";
    if (filterState === "failed") return item.status === "FAILED";
    if (filterState === "cancelled") return item.status === "CANCELLED";
    return true;
  });

  const handleRetry = async (e: React.MouseEvent, email: ScheduledEmail) => {
    e.stopPropagation();
    if (!email.id) return;

    setRetryingIds((prev) => ({ ...prev, [email.id]: true }));
    try {
      await api.retryEmail(email.id);
      onToast?.("success", "Email Retried", `Email to ${email.recipientEmail} re-enqueued for delivery in 30s.`);
      onRefresh();
    } catch (err: any) {
      onToast?.("error", "Retry failed", err.message || "Failed to retry email");
    } finally {
      setRetryingIds((prev) => ({ ...prev, [email.id]: false }));
    }
  };

  if (isLoading && (!emails || emails.length === 0)) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#9CA3AF]">
        <div className="w-7 h-7 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px]">Loading dispatched emails...</span>
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <div className="py-16 text-center px-4 border border-dashed border-[#EDEDED] rounded-2xl bg-[#FAFAFA] my-6 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center mx-auto mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-[15px] font-bold text-[#1F2937] mb-1">No sent emails yet</h3>
        <p className="text-[12.5px] text-[#9CA3AF] mb-5 max-w-xs mx-auto">
          Dispatched and delivered emails will appear here with delivery timestamps, message previews, and error logs.
        </p>
        <button
          type="button"
          onClick={onOpenCompose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00A859] text-white hover:bg-[#008f4c] text-[13px] font-semibold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Send First Email</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sub-filter bar for Sent / Failed / Cancelled */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#F4F5F6] bg-[#FAFAFA] text-[12px]">
        <span className="text-[#9CA3AF] text-[11px] font-semibold uppercase tracking-wider mr-1">Filter:</span>
        <button
          type="button"
          onClick={() => setFilterState("all")}
          className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
            filterState === "all" ? "bg-[#1F2937] text-white" : "text-[#6B7280] hover:bg-[#E5E7EB]"
          }`}
        >
          All ({baseItems.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterState("sent")}
          className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
            filterState === "sent" ? "bg-[#00A859] text-white" : "text-[#6B7280] hover:bg-[#E5E7EB]"
          }`}
        >
          Sent ({baseItems.filter((i) => i.status === "SENT").length})
        </button>
        <button
          type="button"
          onClick={() => setFilterState("failed")}
          className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
            filterState === "failed" ? "bg-rose-600 text-white" : "text-[#6B7280] hover:bg-[#E5E7EB]"
          }`}
        >
          Failed ({baseItems.filter((i) => i.status === "FAILED").length})
        </button>
        <button
          type="button"
          onClick={() => setFilterState("cancelled")}
          className={`px-2.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
            filterState === "cancelled" ? "bg-amber-600 text-white" : "text-[#6B7280] hover:bg-[#E5E7EB]"
          }`}
        >
          Cancelled ({baseItems.filter((i) => i.status === "CANCELLED").length})
        </button>
      </div>

      {displayItems.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-[#9CA3AF]">
          No emails found matching filter: <span className="font-semibold text-[#374151]">{filterState}</span>
        </div>
      ) : (
        displayItems.map((email) => {
          const timeBadgeText = formatDisplayTime(email.sentAt || email.scheduledAt);

          const rawSnippet = (email.body || "No content")
            .replace(/<[^>]*>?/gm, "")
            .replace(/\n/g, " ")
            .trim();

          const formattedRecipient = email.recipientEmail.includes("@")
            ? email.recipientEmail.split("@")[0]
            : email.recipientEmail;

          const isFailed = email.status === "FAILED";
          const isCancelled = email.status === "CANCELLED";
          const isRetrying = Boolean(retryingIds[email.id]);

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail && onSelectEmail(email)}
              className="py-3 px-4 flex items-center justify-between border-b border-[#F4F5F6] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer text-[13px] group"
            >
              <div className="flex items-center min-w-0 flex-1 pr-3">
                {/* Column 1: To: Recipient */}
                <div className="w-40 sm:w-48 shrink-0 font-bold text-[#1F2937] truncate pr-2">
                  To: {formattedRecipient}
                </div>

                {/* Column 2: Status Badge */}
                <div className="shrink-0 mr-3">
                  {isFailed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
                      <AlertCircle className="w-3 h-3 text-[#B91C1C]" />
                      <span>Failed</span>
                    </span>
                  ) : isCancelled ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                      <Ban className="w-3 h-3 text-[#92400E]" />
                      <span>Cancelled</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                      <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                      <span>{timeBadgeText}</span>
                    </span>
                  )}
                </div>

                {/* Column 3: Subject & Body Snippet or Error Details */}
                <div className="flex items-center min-w-0 truncate flex-1">
                  <span className="font-semibold text-[#1F2937] shrink-0 mr-1.5">
                    {email.subject}
                  </span>
                  {isFailed && email.errorMessage ? (
                    <span
                      title={email.errorMessage}
                      className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11.5px] truncate max-w-md font-mono cursor-help ml-1"
                    >
                      Error: {email.errorMessage}
                    </span>
                  ) : (
                    <span className="text-[#9CA3AF] truncate">
                      - {rawSnippet}
                    </span>
                  )}
                </div>
              </div>

              {/* Retry Button for Failed Jobs */}
              {isFailed && (
                <div className="shrink-0 flex items-center">
                  <button
                    type="button"
                    onClick={(e) => handleRetry(e, email)}
                    disabled={isRetrying}
                    title="Retry failed email"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#00A859] text-[#00A859] hover:bg-[#EAF7EE] text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    {isRetrying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCw className="w-3 h-3" />
                    )}
                    <span>Retry</span>
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

export default SentTable;
